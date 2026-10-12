import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addChatMessage,
  addPlayer,
  createGame,
  endTurn,
  finishMovement,
  makeAccusation,
  makeSuggestion,
  movePlayer,
  refreshHands,
  rollForTurn,
  startGame,
  submitSuggestionResponse,
  toggleReady,
  updateSettings,
} from "../../../src/game/engine.ts";
import type { GameState, RuleSettings, RoomId } from "../../../src/game/types.ts";
import { CHARACTERS, DEFAULT_RULES, findCharacterByName } from "../../../src/game/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | { type: "create"; roomName: string; characterId: string; settings?: Partial<RuleSettings> }
  | { type: "join"; roomCode: string; characterId: string }
  | { type: "get"; roomCode: string }
  | { type: "ready"; roomCode: string }
  | { type: "settings"; roomCode: string; settings: Partial<RuleSettings> }
  | { type: "start"; roomCode: string }
  | { type: "roll"; roomCode: string }
  | { type: "move"; roomCode: string; destination: number }
  | { type: "finish_movement"; roomCode: string }
  | { type: "suggest"; roomCode: string; suspectId: string; weaponId: string }
  | { type: "respond"; roomCode: string; cardId: string | null }
  | { type: "accuse"; roomCode: string; suspectId: string; weaponId: string; roomId: RoomId }
  | { type: "end_turn"; roomCode: string }
  | { type: "chat"; roomCode: string; text: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function viewerSuggestion(suggestion: GameState["suggestion"], viewerId: string) {
  if (!suggestion) return null;
  const { shownCardId: _shownCardId, ...safeSuggestion } = suggestion;
  return suggestion.shownToPlayerId === viewerId && suggestion.shownCardId
    ? { ...safeSuggestion, shownCardId: suggestion.shownCardId }
    : safeSuggestion;
}

function viewerHistory(history: GameState["suggestionHistory"] = [], viewerId = "") {
  return history.map((entry) => {
    const { shownCardId: _shownCardId, ...safeEntry } = entry;
    return entry.shownToPlayerId === viewerId && entry.shownCardId
      ? { ...safeEntry, shownCardId: entry.shownCardId }
      : safeEntry;
  });
}

function publicState(state: GameState, viewerId: string) {
  const { solution: _solution, hands: _hands, notes: _notes, ...safeState } = state;
  return {
    ...safeState,
    suggestion: viewerSuggestion(state.suggestion, viewerId),
    suggestionHistory: viewerHistory(state.suggestionHistory ?? [], viewerId),
    myPlayerId: viewerId,
    myHand: state.hands[viewerId] ?? [],
    myNotes: state.notes[viewerId] ?? {},
  };
}

function publicStoredState(state: GameState) {
  const { solution: _solution, hands: _hands, notes: _notes, ...safeState } = state;
  return { ...safeState, suggestion: viewerSuggestion(state.suggestion, ""), suggestionHistory: viewerHistory(state.suggestionHistory ?? [], "") };
}

async function currentUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function generateRoomCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const { data } = await admin.from("clue_rooms").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not create a unique room code. Please try again.");
}

async function loadRoom(roomCode: string) {
  const { data, error } = await admin.from("clue_rooms").select("id, code, public_state, phase").eq("code", roomCode.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Room not found. Check the code and try again.");
  const { data: secret, error: secretError } = await admin.from("clue_room_secrets").select("engine_state").eq("room_id", data.id).single();
  if (secretError) throw secretError;
  return { room: data, state: secret.engine_state as GameState };
}

async function ensureMember(roomId: string, userId: string) {
  const { data, error } = await admin.from("clue_players").select("id").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("You are not in this room anymore. Rejoin with the room code.");
}

async function syncState(roomId: string, state: GameState) {
  const roomUpdate = await admin.from("clue_rooms").update({ phase: state.phase, public_state: publicStoredState(state) }).eq("id", roomId);
  if (roomUpdate.error) throw roomUpdate.error;

  const playerRows = state.players.map((player) => ({
    room_id: roomId,
    user_id: player.id,
    display_name: player.name,
    color: player.color,
    is_host: player.isHost,
    ready: player.ready,
    eliminated: player.eliminated,
    position: player.position,
  }));
  const players = await admin.from("clue_players").upsert(playerRows, { onConflict: "room_id,user_id" });
  if (players.error) throw players.error;

  const cardRows = state.players.map((player) => ({
    room_id: roomId,
    user_id: player.id,
    card_ids: state.hands[player.id] ?? [],
  }));
  const cards = await admin.from("clue_player_cards").upsert(cardRows, { onConflict: "room_id,user_id" });
  if (cards.error) throw cards.error;

  const secret = await admin.from("clue_room_secrets").update({ solution_ids: state.solution, engine_state: state }).eq("room_id", roomId);
  if (secret.error) throw secret.error;
}

function requestedCharacter(characterId: string) {
  const character = CHARACTERS.find((candidate) => candidate.id === characterId);
  if (!character) throw new Error("Choose one of the available suspects before entering the room.");
  return character;
}

function usedCharacterIds(state: GameState): Set<string> {
  const ids = state.players
    .map((player, index) => player.characterId || findCharacterByName(player.name)?.id || CHARACTERS[index]?.id)
    .filter((id): id is string => Boolean(id));
  return new Set(ids);
}

function ensureCharacterAvailable(state: GameState, characterId: string) {
  const character = requestedCharacter(characterId);
  if (usedCharacterIds(state).has(character.id)) throw new Error(`${character.name} is already being played in this room. Choose another suspect.`);
  return character;
}

async function createRoom(userId: string, action: Extract<Action, { type: "create" }>) {
  const roomCode = await generateRoomCode();
  const settings: RuleSettings = { ...DEFAULT_RULES, ...(action.settings ?? {}) };
  const character = requestedCharacter(action.characterId);
  const state = createGame(roomCode, action.roomName.trim().slice(0, 36) || "The Unnamed Estate", [{ id: userId, characterId: character.id }], settings);
  const room = await admin.from("clue_rooms").insert({ code: roomCode, room_name: state.roomName, host_id: userId, phase: state.phase, public_state: publicStoredState(state) }).select("id").single();
  if (room.error) throw room.error;
  const roomId = room.data.id as string;
  const player = await admin.from("clue_players").insert({ room_id: roomId, user_id: userId, display_name: state.players[0].name, color: state.players[0].color, is_host: true, position: state.players[0].position }).select("id").single();
  if (player.error) throw player.error;
  const secret = await admin.from("clue_room_secrets").insert({ room_id: roomId, solution_ids: state.solution, engine_state: state });
  if (secret.error) throw secret.error;
  const cards = await admin.from("clue_player_cards").insert({ room_id: roomId, user_id: userId, card_ids: [] });
  if (cards.error) throw cards.error;
  return { roomCode, state: publicState(state, userId) };
}

async function joinRoom(userId: string, action: Extract<Action, { type: "join" }>) {
  const loaded = await loadRoom(action.roomCode);
  const state = loaded.state;
  if (state.players.some((player) => player.id === userId)) return { roomCode: state.roomCode, state: publicState(state, userId) };
  if (state.phase !== "lobby") throw new Error("This game has already started.");
  if (state.players.length >= 7) throw new Error("This room is full.");
  const character = ensureCharacterAvailable(state, action.characterId);
  const next = addPlayer(state, { id: userId, characterId: character.id });
  await syncState(loaded.room.id, next);
  return { roomCode: next.roomCode, state: publicState(next, userId) };
}

async function dispatch(userId: string, action: Action) {
  if (action.type === "create") return createRoom(userId, action);
  if (action.type === "join") return joinRoom(userId, action);
  if (!("roomCode" in action)) throw new Error("A room code is required.");
  const loaded = await loadRoom(action.roomCode);
  await ensureMember(loaded.room.id, userId);
  if (action.type === "get") return { roomCode: loaded.state.roomCode, state: publicState(loaded.state, userId) };
  let next = loaded.state;
  switch (action.type) {
    case "ready":
      next = toggleReady(next, userId);
      break;
    case "settings":
      if (next.hostId !== userId) throw new Error("Only the host can change house rules.");
      next = updateSettings(next, action.settings);
      break;
    case "start":
      if (next.hostId !== userId) throw new Error("Only the host can start the game.");
      next = startGame(next);
      break;
    case "roll":
      next = rollForTurn(next, userId);
      break;
    case "move":
      next = movePlayer(next, userId, action.destination);
      break;
    case "finish_movement":
      next = finishMovement(next, userId);
      break;
    case "suggest":
      next = makeSuggestion(next, userId, action.suspectId, action.weaponId);
      break;
    case "respond":
      next = submitSuggestionResponse(next, userId, action.cardId);
      break;
    case "accuse":
      next = makeAccusation(next, userId, action.suspectId, action.weaponId, action.roomId);
      break;
    case "end_turn":
      next = endTurn(next, userId);
      break;
    case "chat":
      next = addChatMessage(next, userId, action.text);
      break;
    default:
      throw new Error("Unknown action.");
  }
  await syncState(loaded.room.id, next);
  return { roomCode: next.roomCode, state: publicState(next, userId) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Sign in anonymously before joining a room." }, 401);
    const action = (await request.json()) as Action;
    const result = await dispatch(user.id, action);
    return json(result);
  } catch (error) {
    console.error("game-action error", error);
    const details = (error && typeof error === "object" ? error : {}) as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message = [details.message, details.details, details.hint, details.code]
      .filter(Boolean)
      .map(String)
      .join(" | ") || (error instanceof Error ? error.message : "Something went wrong.");
    return json({ error: message }, 400);
  }
});
