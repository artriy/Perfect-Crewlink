use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    env,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

const OPEN_AS_ADMINISTRATOR_ERROR: &str =
    "Error with checking the process:\nCouldn't connect to Among Us.\nPlease re-open Perfect Crewlink as Administrator.";
const LOOKUP_FETCH_ERROR: &str =
    "Error with fetching offsets:\nPlease check your internet connection.";
const OFFSETS_FETCH_ERROR: &str =
    "Error with fetching offsets:\nPlease check your internet connection.";
const UNSUPPORTED_VERSION_ERROR: &str =
    "Your version of Among Us is unsupported by Perfect Crewlink.\n";

const NOTIFY_GAME_OPENED: &str = "NOTIFY_GAME_OPENED";
const NOTIFY_GAME_STATE_CHANGED: &str = "NOTIFY_GAME_STATE_CHANGED";
const NOTIFY_PLAYERCOLORS_CHANGED: &str = "NOTIFY_PLAYERCOLORS_CHANGED";
const ERROR_EVENT: &str = "ERROR";

const GAME_STATE_LOBBY: u8 = 0;
const GAME_STATE_TASKS: u8 = 1;
const GAME_STATE_DISCUSSION: u8 = 2;
const GAME_STATE_MENU: u8 = 3;
const GAME_STATE_UNKNOWN: u8 = 4;

const MAP_TYPE_THE_SKELD: u8 = 0;
const MAP_TYPE_MIRA_HQ: u8 = 1;
const MAP_TYPE_POLUS: u8 = 2;
const MAP_TYPE_AIRSHIP: u8 = 4;
const MAP_TYPE_FUNGLE: u8 = 5;
const MAP_TYPE_UNKNOWN: u8 = 6;
const MAP_TYPE_SUBMERGED: u8 = 105;

const CAMERA_SKELD: u8 = 6;
const CAMERA_NONE: u8 = 7;

const RAINBOW_COLOR_ID: i32 = -99234;
const MINI_REGION_INSTALL_CONFIG: &str = "at.duikbo.regioninstall.cfg";

// 2024 x86 IL2CPP field offsets from .calib/dump/dump.cs. Used only as an
// authoritative MeetingHud card identity source; unsupported layouts do not
// emit meeting cards instead of guessing card order.
const MEETING_HUD_VOTE_ORIGIN_OFFSET_X86: u64 = 0x40;
const MEETING_HUD_VOTE_BUTTON_OFFSETS_OFFSET_X86: u64 = 0x4c;
const MEETING_HUD_PLAYER_STATES_OFFSET_X86: u64 = 0x5c;
const PLAYER_VOTE_AREA_TARGET_PLAYER_ID_OFFSET_X86: u64 = 0x14;
const PLAYER_VOTE_AREA_AM_DEAD_OFFSET_X86: u64 = 0x59;
const IL2CPP_ARRAY_LENGTH_OFFSET_X86: u64 = 0x0c;
const IL2CPP_ARRAY_DATA_OFFSET_X86: u64 = 0x10;
const VANILLA_MEETING_COLUMNS: usize = 3;
const ALELUDU_MEETING_OVERLAY_LEFT_PCT: f32 = 8.05;
const ALELUDU_MEETING_OVERLAY_TOP_PCT: f32 = 11.95;
const ALELUDU_MEETING_OVERLAY_WIDTH_PCT: f32 = 83.9;
const ALELUDU_MEETING_OVERLAY_HEIGHT_PCT: f32 = 76.1;
const ALELUDU_TABLET_OVERLAY_TOP_PCT: f32 = 12.0;
const ALELUDU_CARD_COLUMNS: usize = 4;
const ALELUDU_CARD_WIDTH_PCT: [f32; ALELUDU_CARD_COLUMNS] = [22.6, 22.5, 22.6, 22.6];
const ALELUDU_CARD_CENTER_PCT: [f32; ALELUDU_CARD_COLUMNS] = [13.8, 38.3, 62.4, 86.9];
const ALELUDU_CARD_ROW0_CENTER_PCT: f32 = 5.0;
const ALELUDU_CARD_ROW_HEIGHT_PCT: f32 = 10.0;
const ALELUDU_CARD_ROW_GAP_PCT: f32 = 2.4;

#[derive(Clone, Copy)]
struct Vec3 {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Clone, Copy)]
struct OverlayRectPct {
    left: f32,
    top: f32,
    width: f32,
    height: f32,
}

#[derive(Clone, Copy)]
struct RawMeetingCard {
    player_id: u32,
    am_dead: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionPhase {
    Detached,
    Attaching,
    Warmup,
    Active,
    Recovering,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingHudCard {
    pub slot_index: u32,
    pub player_id: u32,
    pub client_id: Option<u32>,
    pub visible: bool,
    pub am_dead: bool,
    pub world_x: Option<f32>,
    pub world_y: Option<f32>,
    pub world_z: Option<f32>,
    pub overlay_left: Option<f32>,
    pub overlay_top: Option<f32>,
    pub overlay_width: Option<f32>,
    pub overlay_height: Option<f32>,
    pub width: Option<f32>,
    pub height: Option<f32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingHudSnapshot {
    pub state: i32,
    pub source: String,
    pub old_hud: bool,
    pub overlay_left: Option<f32>,
    pub overlay_top: Option<f32>,
    pub overlay_width: Option<f32>,
    pub overlay_height: Option<f32>,
    pub cards: Vec<MeetingHudCard>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub ptr: u64,
    pub id: u32,
    pub client_id: u32,
    pub name: String,
    pub name_hash: i32,
    pub color_id: i32,
    pub hat_id: String,
    pub pet_id: u32,
    pub skin_id: String,
    pub visor_id: String,
    pub disconnected: bool,
    pub is_impostor: bool,
    pub is_dead: bool,
    pub task_ptr: u64,
    pub object_ptr: u64,
    pub is_local: bool,
    pub shifted_color: i32,
    pub bugged: bool,
    pub x: f32,
    pub y: f32,
    pub in_vent: bool,
    pub is_dummy: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmongUsState {
    pub game_state: u8,
    pub old_game_state: u8,
    pub lobby_code_int: i32,
    pub lobby_code: String,
    pub players: Vec<Player>,
    pub is_host: bool,
    pub client_id: u32,
    pub host_id: u32,
    pub coms_sabotaged: bool,
    pub current_camera: u8,
    pub map: u8,
    pub light_radius: f32,
    pub light_radius_changed: bool,
    pub closed_doors: Vec<u32>,
    pub current_server: String,
    pub current_server_label: String,
    pub max_players: u8,
    #[serde(rename = "mod")]
    pub mod_name: String,
    pub old_meeting_hud: bool,
    pub meeting_hud: Option<MeetingHudSnapshot>,
}

impl Default for AmongUsState {
    fn default() -> Self {
        Self {
            game_state: GAME_STATE_UNKNOWN,
            old_game_state: GAME_STATE_UNKNOWN,
            lobby_code_int: -1,
            lobby_code: "MENU".to_string(),
            players: Vec::new(),
            is_host: false,
            client_id: 0,
            host_id: 0,
            coms_sabotaged: false,
            current_camera: 0,
            map: 0,
            light_radius: 0.0,
            light_radius_changed: false,
            closed_doors: Vec::new(),
            current_server: String::new(),
            current_server_label: String::new(),
            max_players: 0,
            mod_name: "NONE".to_string(),
            old_meeting_hud: false,
            meeting_hud: None,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSessionStatus {
    pub is_game_open: bool,
    pub phase: SessionPhase,
    pub state: Option<AmongUsState>,
}

#[derive(Clone)]
pub struct SessionSnapshot {
    pub is_game_open: bool,
    pub phase: SessionPhase,
    pub state: Option<AmongUsState>,
    pub current_mod: String,
    pub player_colors: Vec<[String; 2]>,
}

fn default_player_colors() -> Vec<[String; 2]> {
    vec![
        ["#C51111".to_string(), "#7A0838".to_string()],
        ["#132ED1".to_string(), "#09158E".to_string()],
        ["#117F2D".to_string(), "#0A4D2E".to_string()],
        ["#ED54BA".to_string(), "#AB2BAD".to_string()],
        ["#EF7D0D".to_string(), "#B33E15".to_string()],
        ["#F5F557".to_string(), "#C38823".to_string()],
        ["#3F474E".to_string(), "#1E1F26".to_string()],
        ["#FFFFFF".to_string(), "#8394BF".to_string()],
        ["#6B2FBB".to_string(), "#3B177C".to_string()],
        ["#71491E".to_string(), "#5E2615".to_string()],
        ["#38FEDC".to_string(), "#24A8BE".to_string()],
        ["#50EF39".to_string(), "#15A742".to_string()],
    ]
}

impl Default for SessionSnapshot {
    fn default() -> Self {
        Self {
            is_game_open: false,
            phase: SessionPhase::Detached,
            state: Some(AmongUsState::default()),
            current_mod: "NONE".to_string(),
            player_colors: default_player_colors(),
        }
    }
}

impl SessionSnapshot {
    pub fn local_player_is_impostor(&self) -> bool {
        let Some(state) = &self.state else {
            return false;
        };

        state
            .players
            .iter()
            .find(|player| player.client_id == state.client_id)
            .map(|player| player.is_impostor)
            .unwrap_or(false)
    }
}

pub type SharedSessionSnapshot = Arc<Mutex<SessionSnapshot>>;

#[derive(Default)]
pub struct GameSessionManager {
    started: AtomicBool,
    snapshot: SharedSessionSnapshot,
}

impl GameSessionManager {
    pub fn ensure_started(&self, app: AppHandle) {
        if self
            .started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            let snapshot = self.snapshot.clone();
            thread::spawn(move || {
                let panic_app = app.clone();
                let panic_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
                    let mut worker = GameSessionWorker::new(app, snapshot);
                    worker.run();
                }));

                if let Err(panic) = panic_result {
                    let message = if let Some(message) = panic.downcast_ref::<&str>() {
                        (*message).to_string()
                    } else if let Some(message) = panic.downcast_ref::<String>() {
                        message.clone()
                    } else {
                        "unknown panic".to_string()
                    };
                    debug_log(&format!("worker panic: {message}"));

                    let _ = panic_app.emit(
                        ERROR_EVENT,
                        format!("Game session worker crashed:\n{message}"),
                    );
                }
            });
        }
    }

    pub fn snapshot(&self) -> SharedSessionSnapshot {
        self.snapshot.clone()
    }

    pub fn status(&self) -> GameSessionStatus {
        let snapshot = self.snapshot.lock().unwrap();
        GameSessionStatus {
            is_game_open: snapshot.is_game_open,
            phase: snapshot.phase,
            state: snapshot.state.clone(),
        }
    }

    pub fn initial_state(&self) -> Option<AmongUsState> {
        self.snapshot.lock().unwrap().state.clone()
    }

    pub fn current_mod(&self) -> String {
        let current_mod = self.snapshot.lock().unwrap().current_mod.clone();
        if current_mod.is_empty() {
            "NONE".to_string()
        } else {
            current_mod
        }
    }
}

#[derive(Clone, Copy)]
struct ModDefinition {
    id: &'static str,
    dll_starts_with: Option<&'static str>,
}

const MODS: [ModDefinition; 6] = [
    ModDefinition {
        id: "NONE",
        dll_starts_with: None,
    },
    ModDefinition {
        id: "TOWN_OF_US_MIRA",
        dll_starts_with: Some("TownOfUsMira"),
    },
    ModDefinition {
        id: "TOWN_OF_US",
        dll_starts_with: Some("TownOfUs"),
    },
    ModDefinition {
        id: "THE_OTHER_ROLES",
        dll_starts_with: Some("TheOtherRoles"),
    },
    ModDefinition {
        id: "LAS_MONJAS",
        dll_starts_with: Some("LasMonjas"),
    },
    ModDefinition {
        id: "OTHER",
        dll_starts_with: None,
    },
];

#[derive(Deserialize)]
struct MiniRegionInstallPayload {
    #[serde(rename = "Regions", default)]
    regions: Vec<MiniRegionInstallRegion>,
}

#[derive(Deserialize)]
struct MiniRegionInstallRegion {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "PingServer")]
    ping_server: Option<String>,
    #[serde(rename = "Servers", default)]
    servers: Vec<MiniRegionInstallServer>,
}

#[derive(Deserialize)]
struct MiniRegionInstallServer {
    #[serde(rename = "Ip")]
    ip: String,
    #[serde(rename = "Port")]
    port: Option<u16>,
}

#[derive(Deserialize)]
struct OffsetLookup {
    patterns: LookupPatterns,
    versions: HashMap<String, LookupVersion>,
}

#[derive(Deserialize)]
struct LookupPatterns {
    x64: LookupPatternSet,
    x86: LookupPatternSet,
}

#[derive(Deserialize)]
struct LookupPatternSet {
    #[serde(rename = "broadcastVersion")]
    broadcast_version: Signature,
}

#[derive(Deserialize)]
struct LookupVersion {
    file: String,
}

#[derive(Clone, Deserialize)]
struct Signature {
    sig: String,
    #[serde(rename = "patternOffset")]
    pattern_offset: usize,
    #[serde(rename = "addressOffset")]
    address_offset: usize,
}

#[derive(Clone, Deserialize)]
struct Offsets {
    #[serde(rename = "meetingHud")]
    meeting_hud: Vec<usize>,
    #[serde(rename = "objectCachePtr")]
    object_cache_ptr: Vec<usize>,
    #[serde(rename = "meetingHudState")]
    meeting_hud_state: Vec<usize>,
    #[serde(rename = "allPlayersPtr")]
    all_players_ptr: Vec<usize>,
    #[serde(rename = "allPlayers")]
    all_players: Vec<usize>,
    #[serde(rename = "playerCount")]
    player_count: Vec<usize>,
    #[serde(rename = "playerAddrPtr")]
    player_addr_ptr: usize,
    #[serde(rename = "shipStatus")]
    ship_status: Vec<usize>,
    #[serde(rename = "shipStatus_systems")]
    ship_status_systems: Vec<usize>,
    #[serde(rename = "shipstatus_allDoors")]
    shipstatus_all_doors: Vec<usize>,
    #[serde(rename = "door_isOpen")]
    door_is_open: usize,
    #[serde(rename = "deconDoorUpperOpen")]
    decon_door_upper_open: Vec<usize>,
    #[serde(rename = "deconDoorLowerOpen")]
    decon_door_lower_open: Vec<usize>,
    #[serde(rename = "hqHudSystemType_CompletedConsoles")]
    hq_hud_system_type_completed_consoles: Vec<usize>,
    #[serde(rename = "HudOverrideSystemType_isActive")]
    hud_override_system_type_is_active: Vec<usize>,
    #[serde(rename = "miniGame")]
    mini_game: Vec<usize>,
    #[serde(rename = "planetSurveillanceMinigame_currentCamera")]
    planet_surveillance_minigame_current_camera: Vec<usize>,
    #[serde(rename = "planetSurveillanceMinigame_camarasCount")]
    planet_surveillance_minigame_camaras_count: Vec<usize>,
    #[serde(rename = "surveillanceMinigame_FilteredRoomsCount")]
    surveillance_minigame_filtered_rooms_count: Vec<usize>,
    #[serde(rename = "lightRadius")]
    light_radius: Vec<usize>,
    palette: Vec<usize>,
    #[serde(rename = "palette_shadowColor")]
    palette_shadow_color: Vec<usize>,
    #[serde(rename = "palette_playercolor")]
    palette_player_color: Vec<usize>,
    #[serde(rename = "gameoptionsData")]
    gameoptions_data: Vec<usize>,
    #[serde(rename = "gameOptions_MapId")]
    game_options_map_id: Vec<usize>,
    #[serde(rename = "gameOptions_MaxPLayers")]
    game_options_max_players: Vec<usize>,
    #[serde(rename = "serverManager_currentServer")]
    server_manager_current_server: Vec<usize>,
    #[serde(rename = "innerNetClient")]
    inner_net_client: InnerNetClientOffsets,
    player: PlayerOffsets,
    signatures: Signatures,
    #[serde(rename = "oldMeetingHud")]
    old_meeting_hud: bool,
}

#[derive(Clone, Deserialize)]
struct InnerNetClientOffsets {
    base: Vec<usize>,
    #[serde(rename = "gameId")]
    game_id: usize,
    #[serde(rename = "hostId")]
    host_id: usize,
    #[serde(rename = "clientId")]
    client_id: usize,
    #[serde(rename = "gameState")]
    game_state: usize,
}

#[derive(Clone, Deserialize)]
struct PlayerOffsets {
    #[serde(rename = "isDummy")]
    is_dummy: Vec<usize>,
    #[serde(rename = "localX")]
    local_x: Vec<usize>,
    #[serde(rename = "localY")]
    local_y: Vec<usize>,
    #[serde(rename = "remoteX")]
    remote_x: Vec<usize>,
    #[serde(rename = "remoteY")]
    remote_y: Vec<usize>,
    #[serde(rename = "bufferLength")]
    buffer_length: usize,
    offsets: Vec<usize>,
    #[serde(rename = "inVent")]
    in_vent: Vec<usize>,
    #[serde(rename = "clientId")]
    client_id: Vec<usize>,
    #[serde(rename = "currentOutfit")]
    current_outfit: Vec<usize>,
    #[serde(rename = "roleTeam")]
    role_team: Vec<usize>,
    outfit: OutfitOffsets,
    #[serde(rename = "struct")]
    struct_layout: Vec<StructMember>,
}

#[derive(Clone, Deserialize)]
struct OutfitOffsets {
    #[serde(rename = "colorId")]
    color_id: Vec<usize>,
    #[serde(rename = "playerName")]
    player_name: Vec<usize>,
    #[serde(rename = "hatId")]
    hat_id: Vec<usize>,
    #[serde(rename = "skinId")]
    skin_id: Vec<usize>,
    #[serde(rename = "visorId")]
    visor_id: Vec<usize>,
}

#[derive(Clone, Deserialize)]
struct StructMember {
    #[serde(rename = "type")]
    member_type: String,
    skip: Option<usize>,
    name: String,
}

#[derive(Clone, Deserialize)]
struct Signatures {
    #[serde(rename = "innerNetClient")]
    inner_net_client: Signature,
    #[serde(rename = "meetingHud")]
    meeting_hud: Signature,
    #[serde(rename = "gameData")]
    game_data: Signature,
    #[serde(rename = "shipStatus")]
    ship_status: Signature,
    #[serde(rename = "miniGame")]
    mini_game: Signature,
    palette: Signature,
    #[serde(rename = "playerControl")]
    player_control: Signature,
    #[serde(rename = "serverManager")]
    server_manager: Signature,
    #[serde(rename = "gameOptionsManager")]
    game_options_manager: Signature,
}

#[derive(Default)]
struct ParsedPlayerData {
    id: u32,
    outfits_ptr: u64,
    role_ptr: u64,
    task_ptr: u64,
    disconnected: u32,
    dead: u32,
    object_ptr: u64,
    name: Option<u64>,
    color: i32,
    hat: String,
    skin: String,
    visor: String,
    pet: u32,
    impostor: u32,
}

struct GameSessionWorker {
    app: AppHandle,
    snapshot: SharedSessionSnapshot,
    check_process_delay: i32,
    reader: Option<AmongUsReader>,
}

impl GameSessionWorker {
    fn new(app: AppHandle, snapshot: SharedSessionSnapshot) -> Self {
        Self {
            app,
            snapshot,
            check_process_delay: 0,
            reader: None,
        }
    }

    fn run(&mut self) {
        let mut emitted_error = false;

        loop {
            match self.tick() {
                Ok(()) => {
                    if emitted_error {
                        let _ = self.app.emit(ERROR_EVENT, "");
                        emitted_error = false;
                        debug_log("worker recovered");
                    }
                    thread::sleep(Duration::from_millis(200));
                }
                Err(error) => {
                    debug_log(&format!("worker error: {error}"));
                    let _ = self.app.emit(ERROR_EVENT, error.clone());
                    emitted_error = true;
                    {
                        let mut snapshot = self.snapshot.lock().unwrap();
                        if snapshot.is_game_open {
                            snapshot.phase = SessionPhase::Recovering;
                        }
                    }
                    self.reader = None;
                    thread::sleep(Duration::from_millis(7500));
                }
            }
        }
    }

    fn tick(&mut self) -> Result<(), String> {
        if self.check_process_delay <= 0 {
            self.check_process_delay = 30;
            self.refresh_process()?;
        } else {
            self.check_process_delay -= 1;
        }

        if let Some(reader) = &mut self.reader {
            reader.loop_once(&self.snapshot)?;
        }

        Ok(())
    }

    fn refresh_process(&mut self) -> Result<(), String> {
        let existing_pid = self.reader.as_ref().map(|reader| reader.pid);
        let process = find_among_us_process(existing_pid)?;

        match process {
            Some(process) => {
                let should_replace = existing_pid != Some(process.pid);
                if should_replace {
                    let loaded_mod = detect_mod(&process.path);
                    {
                        let mut snapshot = self.snapshot.lock().unwrap();
                        snapshot.is_game_open = true;
                        snapshot.phase = SessionPhase::Attaching;
                        snapshot.current_mod = loaded_mod.to_string();
                        snapshot.state = Some(AmongUsState {
                            mod_name: loaded_mod.to_string(),
                            ..AmongUsState::default()
                        });
                    }
                    debug_log(&format!(
                        "attach candidate pid={} path={} base=0x{:X} size={}",
                        process.pid,
                        process.path.display(),
                        process.game_assembly.base_address,
                        process.game_assembly.size
                    ));
                    let mut reader = AmongUsReader::new(self.app.clone(), process)?;
                    reader.initialize_offsets()?;
                    self.reader = Some(reader);

                    {
                        let mut snapshot = self.snapshot.lock().unwrap();
                        snapshot.is_game_open = true;
                        snapshot.phase = SessionPhase::Warmup;
                        if let Some(reader) = &self.reader {
                            snapshot.current_mod = reader.loaded_mod.to_string();
                            snapshot.state = Some(AmongUsState {
                                mod_name: reader.loaded_mod.to_string(),
                                ..AmongUsState::default()
                            });
                        }
                    }

                    let _ = self.app.emit(NOTIFY_GAME_OPENED, true);
                    debug_log("emitted NOTIFY_GAME_OPENED=true");
                }
            }
            None => {
                if self.reader.take().is_some() {
                    let mut snapshot = self.snapshot.lock().unwrap();
                    snapshot.is_game_open = false;
                    snapshot.phase = SessionPhase::Detached;
                    snapshot.current_mod = "NONE".to_string();
                    snapshot.state = Some(AmongUsState::default());
                    snapshot.player_colors = default_player_colors();
                    let _ = self.app.emit(NOTIFY_GAME_OPENED, false);
                    debug_log("emitted NOTIFY_GAME_OPENED=false");
                } else {
                    let mut snapshot = self.snapshot.lock().unwrap();
                    if snapshot.is_game_open || snapshot.phase != SessionPhase::Detached {
                        snapshot.is_game_open = false;
                        snapshot.phase = SessionPhase::Detached;
                        snapshot.current_mod = "NONE".to_string();
                        snapshot.state = Some(AmongUsState::default());
                        snapshot.player_colors = default_player_colors();
                    }
                }
            }
        }

        Ok(())
    }
}

struct AmongUsReader {
    app: AppHandle,
    process: ProcessHandle,
    pid: u32,
    game_assembly: ModuleInfo,
    is_64_bit: bool,
    offsets: Offsets,
    loaded_mod: &'static str,
    current_server: String,
    region_aliases: HashMap<String, String>,
    old_game_state: u8,
    game_code: String,
    menu_update_timer: i32,
    last_player_ptr: u64,
    old_meeting_hud: bool,
    colors_initialized: bool,
    rainbow_color: i32,
    player_colors: Vec<[String; 2]>,
    meeting_card_order_hud: u64,
    meeting_card_order: Vec<u32>,
}

impl AmongUsReader {
    fn new(app: AppHandle, process_info: ProcessInfo) -> Result<Self, String> {
        let loaded_mod = detect_mod(&process_info.path);
        let is_64_bit = detect_x64_process(&process_info.process, process_info.game_assembly.base_address)?;
        let region_aliases = load_region_aliases(Some(&process_info.path));

        Ok(Self {
            app,
            process: process_info.process,
            pid: process_info.pid,
            game_assembly: process_info.game_assembly,
            is_64_bit,
            offsets: empty_offsets(),
            loaded_mod,
            current_server: String::new(),
            region_aliases,
            old_game_state: GAME_STATE_UNKNOWN,
            game_code: String::new(),
            menu_update_timer: 20,
            last_player_ptr: 0,
            old_meeting_hud: false,
            colors_initialized: false,
            rainbow_color: -9999,
            player_colors: default_player_colors(),
            meeting_card_order_hud: 0,
            meeting_card_order: Vec::new(),
        })
    }

    fn initialize_offsets(&mut self) -> Result<(), String> {
        let lookup = fetch_offset_lookup()?;
        let module_bytes = self
            .process
            .read_bytes(self.game_assembly.base_address, self.game_assembly.size)?;

        let broadcast_signature = if self.is_64_bit {
            &lookup.patterns.x64.broadcast_version
        } else {
            &lookup.patterns.x86.broadcast_version
        };

        let broadcast_version_offset = find_pattern(
            &module_bytes,
            broadcast_signature,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            true,
            0,
        )?;

        let broadcast_version =
            self.process
                .read_i32(self.game_assembly.base_address + broadcast_version_offset as u64)?;

        let version_key = broadcast_version.to_string();
        let version_file = lookup
            .versions
            .get(&version_key)
            .or_else(|| lookup.versions.get("default"))
            .ok_or_else(|| LOOKUP_FETCH_ERROR.to_string())?
            .file
            .clone();
        debug_log(&format!(
            "offset init pid={} is64={} broadcast_version={} file={}",
            self.pid, self.is_64_bit, broadcast_version, version_file
        ));

        let mut offsets = fetch_offsets(self.is_64_bit, &version_file)?;
        offsets.inner_net_client.base[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.inner_net_client,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        offsets.meeting_hud[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.meeting_hud,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        offsets.all_players_ptr[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.game_data,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        offsets.ship_status[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.ship_status,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        offsets.mini_game[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.mini_game,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        offsets.palette[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.palette,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;
        let player_control = find_pattern(
            &module_bytes,
            &offsets.signatures.player_control,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;

        if !offsets.gameoptions_data.is_empty() {
            let game_options_manager = find_pattern(
                &module_bytes,
                &offsets.signatures.game_options_manager,
                self.game_assembly.base_address,
                self.is_64_bit,
                false,
                false,
                0,
            )?;
            offsets.gameoptions_data[0] = game_options_manager;
        } else {
            offsets.gameoptions_data = vec![player_control];
        }

        offsets.server_manager_current_server[0] = find_pattern(
            &module_bytes,
            &offsets.signatures.server_manager,
            self.game_assembly.base_address,
            self.is_64_bit,
            false,
            false,
            0,
        )?;

        self.old_meeting_hud = offsets.old_meeting_hud;
        self.offsets = offsets;
        self.colors_initialized = false;
        self.player_colors = default_player_colors();
        self.current_server.clear();
        self.game_code.clear();
        self.old_game_state = GAME_STATE_UNKNOWN;
        self.menu_update_timer = 20;
        self.last_player_ptr = 0;
        Ok(())
    }

    fn loop_once(&mut self, snapshot: &SharedSessionSnapshot) -> Result<(), String> {
        if let Err(error) = self.load_colors(snapshot) {
            debug_log(&format!("load_colors: {error}"));
        }

        let meeting_hud = match self.read_pointer_from_module(&self.offsets.meeting_hud) {
            Ok(value) => value,
            Err(error) => {
                debug_log(&format!("meeting_hud soft-fail: {error}"));
                0
            }
        };
        let meeting_hud_cache_ptr = if meeting_hud == 0 {
            0
        } else {
            match self.read_pointer(meeting_hud, &self.offsets.object_cache_ptr) {
                Ok(value) => value,
                Err(error) => {
                    debug_log(&format!("meeting_hud_cache_ptr soft-fail: {error}"));
                    0
                }
            }
        };
        let meeting_hud_state = if meeting_hud_cache_ptr == 0 {
            4
        } else {
            match self.read_i32(meeting_hud, &self.offsets.meeting_hud_state) {
                Ok(value) => value,
                Err(error) => {
                    debug_log(&format!("meeting_hud_state soft-fail: {error}"));
                    4
                }
            }
        };

        let inner_net_client = self
            .read_pointer_from_module(&self.offsets.inner_net_client.base)
            .map_err(|error| format!("inner_net_client: {error}"))?;
        let raw_game_state = self
            .read_i32_absolute(inner_net_client + self.offsets.inner_net_client.game_state as u64)
            .map_err(|error| format!("raw_game_state: {error}"))?;

        let state = match raw_game_state {
            0 => GAME_STATE_MENU,
            1 | 3 => GAME_STATE_LOBBY,
            _ => {
                if meeting_hud_state < 4 {
                    GAME_STATE_DISCUSSION
                } else {
                    GAME_STATE_TASKS
                }
            }
        };

        let lobby_code_int = if state == GAME_STATE_MENU {
            -1
        } else {
            self.read_i32_absolute(inner_net_client + self.offsets.inner_net_client.game_id as u64)
                .map_err(|error| format!("lobby_code_int: {error}"))?
        };

        if state == GAME_STATE_MENU {
            self.game_code.clear();
        } else {
            let last_lobby_code = snapshot
                .lock()
                .unwrap()
                .state
                .as_ref()
                .map(|previous| previous.lobby_code_int);
            if last_lobby_code != Some(lobby_code_int) {
                self.game_code = int_to_game_code(lobby_code_int);
            }
        }

        let all_players_ptr = match self.read_pointer_from_module(&self.offsets.all_players_ptr) {
            Ok(value) => value,
            Err(error) => {
                debug_log(&format!("all_players_ptr soft-fail: {error}"));
                0
            }
        };
        let all_players = if all_players_ptr == 0 {
            0
        } else {
            match self.read_pointer(all_players_ptr, &self.offsets.all_players) {
                Ok(value) => value,
                Err(error) => {
                    debug_log(&format!("all_players soft-fail: {error}"));
                    0
                }
            }
        };
        let player_count = if all_players_ptr == 0 {
            0
        } else {
            match self.read_i32(all_players_ptr, &self.offsets.player_count) {
                Ok(value) => value,
                Err(error) => {
                    debug_log(&format!("player_count soft-fail: {error}"));
                    0
                }
            }
        };

        let host_id = self
            .read_u32_absolute(inner_net_client + self.offsets.inner_net_client.host_id as u64)
            .map_err(|error| format!("host_id: {error}"))?;
        let client_id = self
            .read_u32_absolute(inner_net_client + self.offsets.inner_net_client.client_id as u64)
            .map_err(|error| format!("client_id: {error}"))?;
        let is_local_game = lobby_code_int == 32;

        if self.current_server.is_empty()
            || ((self.old_game_state == GAME_STATE_MENU || self.old_game_state == GAME_STATE_UNKNOWN)
                && self.old_game_state != state)
        {
            let _ = self.read_current_server();
        }

        let mut players = Vec::new();
        let mut player_addr_ptr = all_players + self.offsets.player_addr_ptr as u64;
        let mut local_player: Option<Player> = None;

        if (!self.game_code.is_empty() || is_local_game) && player_count > 0 {
            for _ in 0..player_count.min(40) {
                let Some(player_ptr) = self.resolve_address(player_addr_ptr, &self.offsets.player.offsets)? else {
                    player_addr_ptr += self.pointer_size() as u64;
                    continue;
                };

                let player_buffer = self.process.read_bytes(player_ptr, self.offsets.player.buffer_length)?;
                if let Some(player) = self.parse_player(player_ptr, &player_buffer, client_id)? {
                    if is_local_game && player.client_id == host_id {
                        self.game_code = (player.name_hash.rem_euclid(99_999)).to_string();
                    }
                    if player.is_local {
                        local_player = Some(player.clone());
                    }
                    players.push(player);
                }

                player_addr_ptr += self.pointer_size() as u64;
            }
        }

        let mut light_radius = 1.0;
        let mut coms_sabotaged = false;
        let mut current_camera = CAMERA_NONE;
        let mut map = MAP_TYPE_UNKNOWN;
        let mut max_players = 10;
        let mut closed_doors = Vec::new();

        if let Some(local_player) = &local_player {
            light_radius = self
                .read_f32(local_player.object_ptr, &self.offsets.light_radius)
                .unwrap_or(-1.0);
        }

        if !self.offsets.gameoptions_data.is_empty() {
            let game_options_ptr = self.read_pointer_from_module(&self.offsets.gameoptions_data)?;
            max_players = self
                .read_u8(game_options_ptr, &self.offsets.game_options_max_players)
                .unwrap_or(10);
            map = self
                .read_u8(game_options_ptr, &self.offsets.game_options_map_id)
                .unwrap_or(MAP_TYPE_UNKNOWN);

            if state == GAME_STATE_TASKS {
                let ship_ptr = self.read_pointer_from_module(&self.offsets.ship_status)?;
                let systems_ptr = self.read_pointer(ship_ptr, &self.offsets.ship_status_systems)?;

                if systems_ptr != 0 {
                    self.read_dictionary(systems_ptr, 47, |reader, key_ptr, value_ptr, _| {
                        let Ok(key) = reader.read_i32_absolute(key_ptr) else {
                            return;
                        };

                        if key == 14 {
                            let Ok(value) = reader.read_pointer_absolute(value_ptr) else {
                                return;
                            };
                            match map {
                                MAP_TYPE_AIRSHIP | MAP_TYPE_POLUS | MAP_TYPE_FUNGLE | MAP_TYPE_THE_SKELD
                                | MAP_TYPE_SUBMERGED => {
                                    coms_sabotaged = reader
                                        .read_u32(value, &reader.offsets.hud_override_system_type_is_active)
                                        .map(|flag| flag == 1)
                                        .unwrap_or(false);
                                }
                                MAP_TYPE_MIRA_HQ => {
                                    coms_sabotaged = reader
                                        .read_u32(value, &reader.offsets.hq_hud_system_type_completed_consoles)
                                        .map(|count| count < 2)
                                        .unwrap_or(false);
                                }
                                _ => {}
                            }
                        } else if key == 18 && map == MAP_TYPE_MIRA_HQ {
                            let Ok(value) = reader.read_pointer_absolute(value_ptr) else {
                                return;
                            };
                            let lower_open = reader
                                .read_i32(value, &reader.offsets.decon_door_lower_open)
                                .unwrap_or(1);
                            let upper_open = reader
                                .read_i32(value, &reader.offsets.decon_door_upper_open)
                                .unwrap_or(1);

                            if lower_open == 0 {
                                closed_doors.push(0);
                            }
                            if upper_open == 0 {
                                closed_doors.push(1);
                            }
                        }
                    });
                }

                let minigame_ptr = self.read_pointer_from_module(&self.offsets.mini_game)?;
                let minigame_cache_ptr = self.read_pointer(minigame_ptr, &self.offsets.object_cache_ptr)?;
                if minigame_cache_ptr != 0 {
                    if let Some(local_player) = &local_player {
                        if map == MAP_TYPE_POLUS || map == MAP_TYPE_AIRSHIP {
                            let current_camera_id = self
                                .read_u32(
                                    minigame_ptr,
                                    &self.offsets.planet_surveillance_minigame_current_camera,
                                )
                                .unwrap_or(u32::MAX);
                            let camera_count = self
                                .read_u32(
                                    minigame_ptr,
                                    &self.offsets.planet_surveillance_minigame_camaras_count,
                                )
                                .unwrap_or(0);

                            if current_camera_id <= 5 && camera_count == 6 {
                                current_camera = current_camera_id as u8;
                            }
                        } else if map == MAP_TYPE_THE_SKELD {
                            let room_count = self
                                .read_u32(
                                    minigame_ptr,
                                    &self.offsets.surveillance_minigame_filtered_rooms_count,
                                )
                                .unwrap_or(0);
                            if room_count == 4 {
                                let dist = ((local_player.x - -12.9364).powi(2)
                                    + (local_player.y - -2.7928).powi(2))
                                .sqrt();
                                if dist < 0.6 {
                                    current_camera = CAMERA_SKELD;
                                }
                            }
                        }
                    }
                }

                if map != MAP_TYPE_MIRA_HQ {
                    let all_doors = self.read_pointer(ship_ptr, &self.offsets.shipstatus_all_doors)?;
                    let door_count = self
                        .read_i32(all_doors, &self.offsets.player_count)
                        .unwrap_or(0)
                        .min(16);

                    for door_nr in 0..door_count {
                        let door_address = all_doors
                            + self.offsets.player_addr_ptr as u64
                            + door_nr as u64 * self.pointer_size() as u64;
                        let door = self.read_pointer_absolute(door_address)?;
                        let is_open = self
                            .read_i32_absolute(door + self.offsets.door_is_open as u64)
                            .unwrap_or(1)
                            == 1;
                        if !is_open {
                            closed_doors.push(door_nr as u32);
                        }
                    }
                }
            }
        }

        let should_force_menu = self.old_game_state == GAME_STATE_MENU
            && state == GAME_STATE_LOBBY
            && self.menu_update_timer > 0
            && (self.last_player_ptr == all_players || !players.iter().any(|player| player.is_local));

        if should_force_menu {
            self.menu_update_timer -= 1;
        } else {
            self.menu_update_timer = 20;
            self.last_player_ptr = all_players;
        }

        let effective_state = if should_force_menu {
            GAME_STATE_MENU
        } else {
            state
        };

        let lobby_code = if effective_state == GAME_STATE_MENU || self.game_code.is_empty() {
            "MENU".to_string()
        } else {
            self.game_code.clone()
        };

        let previous_light_radius = snapshot
            .lock()
            .unwrap()
            .state
            .as_ref()
            .map(|previous| previous.light_radius)
            .unwrap_or(0.0);
        let meeting_hud_snapshot = self.read_meeting_hud(meeting_hud, meeting_hud_state, &players);

        let new_state = AmongUsState {
            game_state: if lobby_code == "MENU" {
                GAME_STATE_MENU
            } else {
                effective_state
            },
            old_game_state: self.old_game_state,
            lobby_code_int,
            lobby_code,
            players,
            is_host: host_id != 0 && host_id == client_id,
            client_id,
            host_id,
            coms_sabotaged,
            current_camera,
            map,
            light_radius,
            light_radius_changed: (light_radius - previous_light_radius).abs() > f32::EPSILON,
            closed_doors,
            current_server: self.current_server.clone(),
            current_server_label: resolve_region_label(&self.current_server, &self.region_aliases),
            max_players,
            mod_name: self.loaded_mod.to_string(),
            old_meeting_hud: self.old_meeting_hud,
            meeting_hud: meeting_hud_snapshot,
        };

        let previous_state = snapshot.lock().unwrap().state.clone();
        if previous_state.as_ref().map(|previous| previous.game_state) != Some(new_state.game_state)
            || previous_state.as_ref().map(|previous| previous.lobby_code_int) != Some(new_state.lobby_code_int)
            || previous_state
                .as_ref()
                .map(|previous| previous.players.len())
                != Some(new_state.players.len())
        {
            debug_log(&format!(
                "state pid={} raw_state={} effective_state={} emitted_state={} lobby={} players={} host_id={} client_id={}",
                self.pid,
                raw_game_state,
                effective_state,
                new_state.game_state,
                new_state.lobby_code,
                new_state.players.len(),
                new_state.host_id,
                new_state.client_id
            ));
        }

        if state != GAME_STATE_MENU || self.old_game_state != GAME_STATE_MENU {
            let _ = self.app.emit(NOTIFY_GAME_STATE_CHANGED, &new_state);
        }

        {
            let mut snapshot = snapshot.lock().unwrap();
            snapshot.is_game_open = true;
            snapshot.phase = if should_force_menu {
                SessionPhase::Warmup
            } else {
                SessionPhase::Active
            };
            snapshot.current_mod = self.loaded_mod.to_string();
            snapshot.state = Some(new_state);
        }

        self.old_game_state = state;
        Ok(())
    }

    fn aleludu_meeting_overlay_rect() -> OverlayRectPct {
        OverlayRectPct {
            left: ALELUDU_MEETING_OVERLAY_LEFT_PCT,
            top: ALELUDU_MEETING_OVERLAY_TOP_PCT,
            width: ALELUDU_MEETING_OVERLAY_WIDTH_PCT,
            height: ALELUDU_MEETING_OVERLAY_HEIGHT_PCT,
        }
    }

    fn aleludu_card_overlay_rect(slot_index: usize) -> OverlayRectPct {
        let column = slot_index % ALELUDU_CARD_COLUMNS;
        let row = (slot_index / ALELUDU_CARD_COLUMNS) as f32;
        let width = ALELUDU_CARD_WIDTH_PCT[column];
        let top_center = ALELUDU_CARD_ROW0_CENTER_PCT
            + row * (ALELUDU_CARD_ROW_HEIGHT_PCT + ALELUDU_CARD_ROW_GAP_PCT);

        OverlayRectPct {
            left: ALELUDU_CARD_CENTER_PCT[column] - width / 2.0,
            top: ALELUDU_TABLET_OVERLAY_TOP_PCT + top_center - ALELUDU_CARD_ROW_HEIGHT_PCT / 2.0,
            width,
            height: ALELUDU_CARD_ROW_HEIGHT_PCT,
        }
    }

    fn read_meeting_hud(
        &mut self,
        meeting_hud: u64,
        meeting_hud_state: i32,
        players: &[Player],
    ) -> Option<MeetingHudSnapshot> {
        if meeting_hud == 0 || meeting_hud_state >= 4 {
            self.meeting_card_order_hud = 0;
            self.meeting_card_order.clear();
            return None;
        }

        if self.old_game_state != GAME_STATE_DISCUSSION || self.meeting_card_order_hud != meeting_hud {
            self.meeting_card_order_hud = meeting_hud;
            self.meeting_card_order.clear();
        }

        if let Some(cards) = self.read_meeting_cards_from_player_vote_areas(meeting_hud, players) {
            let overlay_rect = Self::aleludu_meeting_overlay_rect();
            return Some(MeetingHudSnapshot {
                state: meeting_hud_state,
                source: "player_vote_area".to_string(),
                old_hud: self.old_meeting_hud,
                overlay_left: Some(overlay_rect.left),
                overlay_top: Some(overlay_rect.top),
                overlay_width: Some(overlay_rect.width),
                overlay_height: Some(overlay_rect.height),
                cards,
            });
        }

        None
    }

    fn read_meeting_cards_from_player_vote_areas(
        &mut self,
        meeting_hud: u64,
        players: &[Player],
    ) -> Option<Vec<MeetingHudCard>> {
        if self.is_64_bit {
            return None;
        }

        let player_states = self
            .read_pointer_absolute(meeting_hud + MEETING_HUD_PLAYER_STATES_OFFSET_X86)
            .ok()?;
        if player_states == 0 {
            return None;
        }

        let count = self
            .read_u32_absolute(player_states + IL2CPP_ARRAY_LENGTH_OFFSET_X86)
            .ok()?
            .min(40) as usize;
        if count == 0 {
            return None;
        }

        let mut raw_cards = Vec::with_capacity(count);
        for index in 0..count {
            let entry = player_states + IL2CPP_ARRAY_DATA_OFFSET_X86 + index as u64 * self.pointer_size() as u64;
            let Ok(vote_area) = self.read_pointer_absolute(entry) else {
                continue;
            };
            if vote_area == 0 {
                continue;
            }

            let Ok(target_player_id) = self.read_u8_absolute(vote_area + PLAYER_VOTE_AREA_TARGET_PLAYER_ID_OFFSET_X86) else {
                continue;
            };
            if target_player_id >= 252 {
                continue;
            }
            let am_dead = self
                .read_u8_absolute(vote_area + PLAYER_VOTE_AREA_AM_DEAD_OFFSET_X86)
                .map(|value| value != 0)
                .unwrap_or(false);
            raw_cards.push(RawMeetingCard {
                player_id: target_player_id as u32,
                am_dead,
            });
        }

        if raw_cards.is_empty() {
            return None;
        }

        if raw_cards.len() != count {
            return None;
        }

        if !self.meeting_card_order.is_empty() && self.meeting_card_order.len() != raw_cards.len() {
            self.meeting_card_order.clear();
        }

        if self.meeting_card_order.is_empty() {
            raw_cards.sort_by_key(|card| card.am_dead);
        } else {
            let mut by_player_id: HashMap<u32, RawMeetingCard> = raw_cards
                .into_iter()
                .map(|card| (card.player_id, card))
                .collect();
            let mut ordered_cards = Vec::with_capacity(by_player_id.len());
            for player_id in &self.meeting_card_order {
                if let Some(card) = by_player_id.remove(player_id) {
                    ordered_cards.push(card);
                }
            }
            ordered_cards.extend(by_player_id.into_values());
            raw_cards = ordered_cards;
        }
        self.meeting_card_order = raw_cards.iter().map(|card| card.player_id).collect();

        let vote_origin = self
            .read_vec3_absolute(meeting_hud + MEETING_HUD_VOTE_ORIGIN_OFFSET_X86)
            .ok();
        let vote_button_offsets = self
            .read_vec3_absolute(meeting_hud + MEETING_HUD_VOTE_BUTTON_OFFSETS_OFFSET_X86)
            .ok();

        let player_by_id: HashMap<u32, &Player> = players.iter().map(|player| (player.id, player)).collect();
        Some(
            raw_cards
                .into_iter()
                .enumerate()
                .map(|(slot_index, card)| {
                    let player = player_by_id.get(&card.player_id).copied();
                    let (world_x, world_y, world_z) = match (vote_origin, vote_button_offsets) {
                        (Some(origin), Some(offsets)) => {
                            let column = (slot_index % VANILLA_MEETING_COLUMNS) as f32;
                            let row = (slot_index / VANILLA_MEETING_COLUMNS) as f32;
                            (
                                Some(origin.x + offsets.x * column),
                                Some(origin.y + offsets.y * row),
                                Some(origin.z + offsets.z),
                            )
                        }
                        _ => (None, None, None),
                    };

                    let overlay_rect = Self::aleludu_card_overlay_rect(slot_index);

                    MeetingHudCard {
                        slot_index: slot_index as u32,
                        player_id: card.player_id,
                        client_id: player.map(|player| player.client_id),
                        visible: player
                            .map(|player| !player.disconnected && !player.bugged && !player.is_dummy)
                            .unwrap_or(false),
                        am_dead: card.am_dead,
                        world_x,
                        world_y,
                        world_z,
                        overlay_left: Some(overlay_rect.left),
                        overlay_top: Some(overlay_rect.top),
                        overlay_width: Some(overlay_rect.width),
                        overlay_height: Some(overlay_rect.height),
                        width: None,
                        height: None,
                    }
                })
                .collect(),
        )
    }

    fn load_colors(&mut self, snapshot: &SharedSessionSnapshot) -> Result<(), String> {
        if self.colors_initialized {
            return Ok(());
        }

        let palette_ptr = self.read_pointer_from_module(&self.offsets.palette)?;
        let player_colors_ptr = self.read_pointer(palette_ptr, &self.offsets.palette_player_color)?;
        let shadow_colors_ptr = self.read_pointer(palette_ptr, &self.offsets.palette_shadow_color)?;
        let color_length = self.read_i32(shadow_colors_ptr, &self.offsets.player_count)?;

        if color_length <= 0
            || color_length > 300
            || (self.loaded_mod == "THE_OTHER_ROLES" && color_length <= 18)
        {
            return Ok(());
        }

        let mut colors = Vec::with_capacity(color_length as usize);
        self.rainbow_color = -9999;

        for index in 0..color_length {
            let offset = self.offsets.player_addr_ptr + index as usize * 4;
            let player_color = self.read_u32_absolute(player_colors_ptr + offset as u64)?;
            let shadow_color = self.read_u32_absolute(shadow_colors_ptr + offset as u64)?;

            if index == 0 && player_color != 4_279_308_742 {
                return Ok(());
            }

            if player_color == 4_278_190_080 {
                self.rainbow_color = index;
            }

            colors.push([number_to_color_hex(player_color), number_to_color_hex(shadow_color)]);
        }

        self.colors_initialized = true;
        self.player_colors = colors.clone();

        {
            let mut guard = snapshot.lock().unwrap();
            guard.player_colors = colors.clone();
        }

        let _ = self.app.emit(NOTIFY_PLAYERCOLORS_CHANGED, colors);
        Ok(())
    }

    fn parse_player(
        &self,
        ptr: u64,
        buffer: &[u8],
        local_client_id: u32,
    ) -> Result<Option<Player>, String> {
        let mut parsed = ParsedPlayerData::default();
        let mut field_offsets = HashMap::new();
        let mut offset = 0usize;

        for member in &self.offsets.player.struct_layout {
            field_offsets.insert(member.name.clone(), offset);
            match member.member_type.as_str() {
                "SKIP" => {
                    offset += member.skip.unwrap_or(0);
                }
                "UINT" => {
                    let value = read_u32_from_slice(buffer, offset)?;
                    match member.name.as_str() {
                        "id" => parsed.id = value,
                        "outfitsPtr" => parsed.outfits_ptr = value as u64,
                        "rolePtr" => parsed.role_ptr = value as u64,
                        "taskPtr" => parsed.task_ptr = value as u64,
                        "disconnected" => parsed.disconnected = value,
                        "objectPtr" => parsed.object_ptr = value as u64,
                        "name" => parsed.name = Some(value as u64),
                        "color" => parsed.color = value as i32,
                        "pet" => parsed.pet = value,
                        "impostor" => parsed.impostor = value,
                        _ => {}
                    }
                    offset += 4;
                }
                "INT" => {
                    let value = read_i32_from_slice(buffer, offset)?;
                    match member.name.as_str() {
                        "color" => parsed.color = value,
                        "impostor" => parsed.impostor = value.max(0) as u32,
                        _ => {}
                    }
                    offset += 4;
                }
                "USHORT" | "SHORT" => {
                    offset += 2;
                }
                "BYTE" | "CHAR" => {
                    let value = *buffer
                        .get(offset)
                        .ok_or_else(|| "Player buffer too short".to_string())?;
                    if member.name == "dead" {
                        parsed.dead = value as u32;
                    }
                    offset += 1;
                }
                "FLOAT" => {
                    offset += 4;
                }
                "INT_BE" | "UINT_BE" | "SHORT_BE" | "USHORT_BE" => {
                    offset += match member.member_type.as_str() {
                        "SHORT_BE" | "USHORT_BE" => 2,
                        _ => 4,
                    };
                }
                _ => return Err(format!("Unsupported player struct member type: {}", member.member_type)),
            }
        }

        if self.is_64_bit {
            if let Some(field_offset) = field_offsets.get("objectPtr") {
                parsed.object_ptr = self.read_pointer_absolute(ptr + *field_offset as u64)?;
            }
            if let Some(field_offset) = field_offsets.get("outfitsPtr") {
                parsed.outfits_ptr = self.read_pointer_absolute(ptr + *field_offset as u64)?;
            }
            if let Some(field_offset) = field_offsets.get("taskPtr") {
                parsed.task_ptr = self.read_pointer_absolute(ptr + *field_offset as u64)?;
            }
            if let Some(field_offset) = field_offsets.get("rolePtr") {
                parsed.role_ptr = self.read_pointer_absolute(ptr + *field_offset as u64)?;
            }
            if parsed.name.is_some() {
                if let Some(field_offset) = field_offsets.get("name") {
                    parsed.name = Some(self.read_pointer_absolute(ptr + *field_offset as u64)?);
                }
            }
        }

        let client_id = self.read_u32(parsed.object_ptr, &self.offsets.player.client_id)?;
        let is_local = client_id == local_client_id && parsed.disconnected == 0;

        let position_offsets = if is_local {
            (&self.offsets.player.local_x, &self.offsets.player.local_y)
        } else {
            (&self.offsets.player.remote_x, &self.offsets.player.remote_y)
        };

        let mut x = self.read_f32(parsed.object_ptr, position_offsets.0).unwrap_or(9999.0);
        let mut y = self.read_f32(parsed.object_ptr, position_offsets.1).unwrap_or(9999.0);
        let current_outfit = self
            .read_u32(parsed.object_ptr, &self.offsets.player.current_outfit)
            .unwrap_or(0);
        let is_dummy = self
            .read_u8(parsed.object_ptr, &self.offsets.player.is_dummy)
            .map(|value| value > 0)
            .unwrap_or(false);

        let mut name = if let Some(name_ptr) = parsed.name {
            strip_rich_text(&self.read_string(name_ptr, 1000).unwrap_or_default())
        } else {
            String::new()
        };
        let mut shifted_color = -1;

        if parsed.outfits_ptr != 0 {
            self.read_dictionary(parsed.outfits_ptr, 16, |reader, key_ptr, value_ptr, _index| {
                let Ok(key) = reader.read_i32_absolute(key_ptr) else {
                    return;
                };
                let Ok(outfit_ptr) = reader.read_pointer_absolute(value_ptr) else {
                    return;
                };

                if key == current_outfit as i32 {
                    if key == 0 {
                        if let Ok(name_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.player_name)
                        {
                            name = strip_rich_text(&reader.read_string(name_ptr, 1000).unwrap_or_default());
                        }
                        parsed.color = reader
                            .read_u32(outfit_ptr, &reader.offsets.player.outfit.color_id)
                            .map(|value| value as i32)
                            .unwrap_or(parsed.color);
                    } else {
                        shifted_color = reader
                            .read_u32(outfit_ptr, &reader.offsets.player.outfit.color_id)
                            .map(|value| value as i32)
                            .unwrap_or(-1);
                    }
                    if let Ok(hat_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.hat_id) {
                        parsed.hat = reader.read_string(hat_ptr, 200).unwrap_or_default();
                    }
                    if let Ok(skin_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.skin_id) {
                        parsed.skin = reader.read_string(skin_ptr, 200).unwrap_or_default();
                    }
                    if let Ok(visor_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.visor_id) {
                        parsed.visor = reader.read_string(visor_ptr, 200).unwrap_or_default();
                    }
                } else if key == 0 {
                    if name.is_empty() {
                        if let Ok(name_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.player_name)
                        {
                            name = strip_rich_text(&reader.read_string(name_ptr, 1000).unwrap_or_default());
                        }
                    }
                    parsed.color = reader
                        .read_u32(outfit_ptr, &reader.offsets.player.outfit.color_id)
                        .map(|value| value as i32)
                        .unwrap_or(parsed.color);
                    if parsed.hat.is_empty() {
                        if let Ok(hat_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.hat_id) {
                            parsed.hat = reader.read_string(hat_ptr, 200).unwrap_or_default();
                        }
                    }
                    if parsed.skin.is_empty() {
                        if let Ok(skin_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.skin_id) {
                            parsed.skin = reader.read_string(skin_ptr, 200).unwrap_or_default();
                        }
                    }
                    if parsed.visor.is_empty() {
                        if let Ok(visor_ptr) = reader.read_pointer(outfit_ptr, &reader.offsets.player.outfit.visor_id) {
                            parsed.visor = reader.read_string(visor_ptr, 200).unwrap_or_default();
                        }
                    }
                }
            });

            parsed.impostor = self
                .read_u32(parsed.role_ptr, &self.offsets.player.role_team)
                .unwrap_or(parsed.impostor);
        }

        let mut bugged = false;
        if parsed.disconnected != 0
            || parsed.color < 0
            || parsed.color as usize >= self.player_colors.len()
        {
            x = 9999.0;
            y = 9999.0;
            bugged = true;
        }

        let color_id = if parsed.color == self.rainbow_color {
            RAINBOW_COLOR_ID
        } else {
            parsed.color
        };
        let name_hash = hash_code(&name);

        Ok(Some(Player {
            ptr,
            id: parsed.id,
            client_id,
            name,
            name_hash,
            color_id,
            hat_id: parsed.hat,
            pet_id: parsed.pet,
            skin_id: parsed.skin,
            visor_id: parsed.visor,
            disconnected: parsed.disconnected != 0,
            is_impostor: parsed.impostor == 1,
            is_dead: parsed.dead == 1,
            task_ptr: parsed.task_ptr,
            object_ptr: parsed.object_ptr,
            is_local,
            shifted_color,
            bugged,
            x: round4(x),
            y: round4(y),
            in_vent: self
                .read_u8(parsed.object_ptr, &self.offsets.player.in_vent)
                .map(|value| value > 0)
                .unwrap_or(false),
            is_dummy,
        }))
    }

    fn read_current_server(&mut self) -> Result<(), String> {
        let server_ptr = self.read_pointer_from_module(&self.offsets.server_manager_current_server)?;
        self.current_server = self
            .read_string(server_ptr, 100)
            .unwrap_or_default()
            .trim()
            .to_string();
        Ok(())
    }

    fn read_dictionary<F>(&self, address: u64, max_len: usize, mut callback: F)
    where
        F: FnMut(&Self, u64, u64, usize),
    {
        let entries_offset = if self.is_64_bit { 0x18 } else { 0x0c };
        let len_offset = if self.is_64_bit { 0x20 } else { 0x10 };
        let entry_size = if self.is_64_bit { 0x18 } else { 0x10 };
        let value_offset = if self.is_64_bit { 0x10 } else { 0x0c };
        let prefix = if self.is_64_bit { 0x20 } else { 0x10 };

        let Ok(entries) = self.read_pointer_absolute(address + entries_offset) else {
            return;
        };
        let Ok(mut len) = self.read_u32_absolute(address + len_offset) else {
            return;
        };

        len = len.min(max_len as u32);

        for index in 0..len as usize {
            let entry_offset = entries + prefix as u64 + entry_size as u64 * index as u64;
            callback(self, entry_offset, entry_offset + value_offset as u64, index);
        }
    }

    fn read_pointer_from_module(&self, offsets: &[usize]) -> Result<u64, String> {
        self.read_pointer(self.game_assembly.base_address, offsets)
    }

    fn read_pointer(&self, address: u64, offsets: &[usize]) -> Result<u64, String> {
        let Some(resolved) = self.resolve_address(address, offsets)? else {
            return Ok(0);
        };
        self.read_pointer_absolute(resolved)
    }

    fn read_i32(&self, address: u64, offsets: &[usize]) -> Result<i32, String> {
        let Some(resolved) = self.resolve_address(address, offsets)? else {
            return Ok(0);
        };
        self.read_i32_absolute(resolved)
    }

    fn read_u32(&self, address: u64, offsets: &[usize]) -> Result<u32, String> {
        let Some(resolved) = self.resolve_address(address, offsets)? else {
            return Ok(0);
        };
        self.read_u32_absolute(resolved)
    }

    fn read_u8(&self, address: u64, offsets: &[usize]) -> Result<u8, String> {
        let Some(resolved) = self.resolve_address(address, offsets)? else {
            return Ok(0);
        };
        self.read_u8_absolute(resolved)
    }

    fn read_f32(&self, address: u64, offsets: &[usize]) -> Result<f32, String> {
        let Some(resolved) = self.resolve_address(address, offsets)? else {
            return Ok(0.0);
        };
        self.read_f32_absolute(resolved)
    }

    fn resolve_address(&self, address: u64, offsets: &[usize]) -> Result<Option<u64>, String> {
        if address == 0 {
            return Ok(None);
        }
        if offsets.is_empty() {
            return Ok(Some(address));
        }

        let mut current = address;
        for offset in offsets.iter().take(offsets.len().saturating_sub(1)) {
            current = self.read_pointer_absolute(current + *offset as u64)?;
            if current == 0 {
                return Ok(None);
            }
        }

        Ok(Some(current + *offsets.last().unwrap() as u64))
    }

    fn read_pointer_absolute(&self, address: u64) -> Result<u64, String> {
        if self.is_64_bit {
            self.process.read_u64(address)
        } else {
            self.process.read_u32(address).map(u64::from)
        }
    }

    fn read_i32_absolute(&self, address: u64) -> Result<i32, String> {
        self.process.read_i32(address)
    }

    fn read_u32_absolute(&self, address: u64) -> Result<u32, String> {
        self.process.read_u32(address)
    }

    fn read_u8_absolute(&self, address: u64) -> Result<u8, String> {
        self.process.read_u8(address)
    }

    fn read_f32_absolute(&self, address: u64) -> Result<f32, String> {
        self.process.read_f32(address)
    }

    fn read_vec3_absolute(&self, address: u64) -> Result<Vec3, String> {
        Ok(Vec3 {
            x: self.read_f32_absolute(address)?,
            y: self.read_f32_absolute(address + 4)?,
            z: self.read_f32_absolute(address + 8)?,
        })
    }

    fn read_string(&self, address: u64, max_length: usize) -> Result<String, String> {
        if address == 0 {
            return Ok(String::new());
        }

        let length_offset = if self.is_64_bit { 0x10 } else { 0x08 };
        let data_offset = if self.is_64_bit { 0x14 } else { 0x0c };
        let length = self
            .read_i32_absolute(address + length_offset)?
            .max(0)
            .min(max_length as i32) as usize;

        if length == 0 {
            return Ok(String::new());
        }

        let bytes = self.process.read_bytes(address + data_offset, length * 2)?;
        let mut utf16 = Vec::with_capacity(length);
        for chunk in bytes.chunks_exact(2) {
            utf16.push(u16::from_le_bytes([chunk[0], chunk[1]]));
        }

        Ok(String::from_utf16_lossy(&utf16).replace('\0', ""))
    }

    fn pointer_size(&self) -> usize {
        if self.is_64_bit {
            8
        } else {
            4
        }
    }
}

fn empty_offsets() -> Offsets {
    Offsets {
        meeting_hud: Vec::new(),
        object_cache_ptr: Vec::new(),
        meeting_hud_state: Vec::new(),
        all_players_ptr: Vec::new(),
        all_players: Vec::new(),
        player_count: Vec::new(),
        player_addr_ptr: 0,
        ship_status: Vec::new(),
        ship_status_systems: Vec::new(),
        shipstatus_all_doors: Vec::new(),
        door_is_open: 0,
        decon_door_upper_open: Vec::new(),
        decon_door_lower_open: Vec::new(),
        hq_hud_system_type_completed_consoles: Vec::new(),
        hud_override_system_type_is_active: Vec::new(),
        mini_game: Vec::new(),
        planet_surveillance_minigame_current_camera: Vec::new(),
        planet_surveillance_minigame_camaras_count: Vec::new(),
        surveillance_minigame_filtered_rooms_count: Vec::new(),
        light_radius: Vec::new(),
        palette: Vec::new(),
        palette_shadow_color: Vec::new(),
        palette_player_color: Vec::new(),
        gameoptions_data: Vec::new(),
        game_options_map_id: Vec::new(),
        game_options_max_players: Vec::new(),
        server_manager_current_server: Vec::new(),
        inner_net_client: InnerNetClientOffsets {
            base: Vec::new(),
            game_id: 0,
            host_id: 0,
            client_id: 0,
            game_state: 0,
        },
        player: PlayerOffsets {
            is_dummy: Vec::new(),
            local_x: Vec::new(),
            local_y: Vec::new(),
            remote_x: Vec::new(),
            remote_y: Vec::new(),
            buffer_length: 0,
            offsets: Vec::new(),
            in_vent: Vec::new(),
            client_id: Vec::new(),
            current_outfit: Vec::new(),
            role_team: Vec::new(),
            outfit: OutfitOffsets {
                color_id: Vec::new(),
                player_name: Vec::new(),
                hat_id: Vec::new(),
                skin_id: Vec::new(),
                visor_id: Vec::new(),
            },
            struct_layout: Vec::new(),
        },
        signatures: Signatures {
            inner_net_client: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            meeting_hud: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            game_data: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            ship_status: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            mini_game: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            palette: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            player_control: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            server_manager: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
            game_options_manager: Signature {
                sig: String::new(),
                pattern_offset: 0,
                address_offset: 0,
            },
        },
        old_meeting_hud: false,
    }
}

fn round4(value: f32) -> f32 {
    (value * 10_000.0).round() / 10_000.0
}

fn hash_code(value: &str) -> i32 {
    let mut hash = 0i32;
    for character in value.chars() {
        hash = hash.wrapping_mul(31).wrapping_add(character as i32);
    }
    hash
}

fn strip_rich_text(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut depth = 0usize;
    for character in input.chars() {
        match character {
            '<' => depth += 1,
            '>' => depth = depth.saturating_sub(1),
            _ if depth == 0 => result.push(character),
            _ => {}
        }
    }
    result
}

fn number_to_color_hex(color: u32) -> String {
    format!(
        "#{:02x}{:02x}{:02x}",
        color & 0xff,
        (color >> 8) & 0xff,
        (color >> 16) & 0xff
    )
}

fn int_to_game_code(input: i32) -> String {
    if input == 0 {
        String::new()
    } else if input <= -1000 {
        int_to_game_code_v2(input)
    } else if input > 0 {
        let bytes = input.to_le_bytes();
        String::from_utf8_lossy(&bytes).to_string()
    } else {
        String::new()
    }
}

fn int_to_game_code_v2(input: i32) -> String {
    const V2: &[u8; 26] = b"QWXRTYLPESDFGHUJKZOCVBINMA";
    let a = input & 0x3ff;
    let b = (input >> 10) & 0xfffff;

    [
        V2[(a % 26) as usize] as char,
        V2[(a / 26) as usize] as char,
        V2[(b % 26) as usize] as char,
        V2[((b / 26) % 26) as usize] as char,
        V2[((b / 676) % 26) as usize] as char,
        V2[((b / 17_576) % 26) as usize] as char,
    ]
    .iter()
    .collect()
}

fn fetch_offset_lookup() -> Result<OffsetLookup, String> {
    fetch_json::<OffsetLookup>("https://raw.githubusercontent.com/OhMyGuus/BetterCrewlink-Offsets/main/lookup.json")
        .or_else(|_| {
            fetch_json::<OffsetLookup>(
                "https://cdn.jsdelivr.net/gh/OhMyGuus/Bettercrewlink-Offsets@main/lookup.json",
            )
        })
        .map_err(|_| LOOKUP_FETCH_ERROR.to_string())
}

fn fetch_offsets(is_64_bit: bool, filename: &str) -> Result<Offsets, String> {
    let arch = if is_64_bit { "x64" } else { "x86" };
    fetch_json::<Offsets>(&format!(
        "https://raw.githubusercontent.com/OhMyGuus/BetterCrewlink-Offsets/main/offsets/{arch}/{filename}"
    ))
    .or_else(|_| {
        fetch_json::<Offsets>(&format!(
            "https://cdn.jsdelivr.net/gh/OhMyGuus/Bettercrewlink-Offsets@main/offsets/{arch}/{filename}"
        ))
    })
    .map_err(|_| OFFSETS_FETCH_ERROR.to_string())
}

fn fetch_json<T: for<'de> Deserialize<'de>>(url: &str) -> Result<T, String> {
    reqwest::blocking::get(url)
        .map_err(|error| error.to_string())?
        .json::<T>()
        .map_err(|error| error.to_string())
}

fn parse_signature(signature: &str) -> Result<Vec<Option<u8>>, String> {
    signature
        .split_whitespace()
        .map(|part| {
            if part == "?" || part == "??" {
                Ok(None)
            } else {
                u8::from_str_radix(part, 16)
                    .map(Some)
                    .map_err(|error| error.to_string())
            }
        })
        .collect()
}

fn find_pattern(
    haystack: &[u8],
    signature: &Signature,
    module_base_address: u64,
    is_64_bit: bool,
    relative: bool,
    get_location: bool,
    skip: usize,
) -> Result<usize, String> {
    let pattern = parse_signature(&signature.sig)?;
    if pattern.is_empty() || haystack.len() < pattern.len() {
        return Err(UNSUPPORTED_VERSION_ERROR.to_string());
    }

    let mut seen = 0usize;
    for index in 0..=(haystack.len() - pattern.len()) {
        if pattern
            .iter()
            .enumerate()
            .all(|(offset, byte)| byte.is_none_or(|value| haystack[index + offset] == value))
        {
            if seen < skip {
                seen += 1;
                continue;
            }

            let instruction_location = index + signature.pattern_offset;
            if get_location {
                return Ok(instruction_location + signature.address_offset);
            }

            let relative_offset = read_i32_from_slice(haystack, instruction_location)? as isize;
            if is_64_bit || relative {
                let absolute = instruction_location as isize
                    + relative_offset
                    + signature.address_offset as isize;
                if absolute < 0 {
                    return Err(UNSUPPORTED_VERSION_ERROR.to_string());
                }
                return Ok(absolute as usize);
            }

            let absolute_address = relative_offset.max(0) as u64;
            if absolute_address < module_base_address {
                return Err(UNSUPPORTED_VERSION_ERROR.to_string());
            }

            return Ok((absolute_address - module_base_address) as usize);
        }
    }

    Err(UNSUPPORTED_VERSION_ERROR.to_string())
}

fn read_u32_from_slice(buffer: &[u8], offset: usize) -> Result<u32, String> {
    let bytes = buffer
        .get(offset..offset + 4)
        .ok_or_else(|| "Buffer underflow".to_string())?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn read_i32_from_slice(buffer: &[u8], offset: usize) -> Result<i32, String> {
    let bytes = buffer
        .get(offset..offset + 4)
        .ok_or_else(|| "Buffer underflow".to_string())?;
    Ok(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn region_lookup_keys(value: &str) -> Vec<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let lowered = trimmed.to_lowercase();
    let mut keys = vec![trimmed.to_string(), lowered.clone()];
    let without_trailing = lowered.trim_end_matches('/').to_string();
    keys.push(without_trailing.clone());

    if without_trailing.starts_with("http://") || without_trailing.starts_with("https://") {
        let without_scheme = without_trailing
            .trim_start_matches("http://")
            .trim_start_matches("https://");
        keys.push(without_scheme.to_string());

        let host_with_port = without_scheme.split('/').next().unwrap_or(without_scheme).to_string();
        keys.push(host_with_port.clone());

        let host_only = host_with_port
            .split_once(':')
            .map(|(host, _)| host.to_string())
            .unwrap_or_else(|| host_with_port.clone());
        keys.push(host_only.clone());

        if let Some(stripped) = host_only.strip_prefix("www.") {
            keys.push(stripped.to_string());
        }
    }

    let mut seen = HashSet::new();
    keys.into_iter().filter(|key| seen.insert(key.clone())).collect()
}

fn insert_region_alias(aliases: &mut HashMap<String, String>, raw_alias: &str, label: &str) {
    let normalized_label = label.trim();
    if normalized_label.is_empty() {
        return;
    }

    for key in region_lookup_keys(raw_alias) {
        aliases.insert(key, normalized_label.to_string());
    }

    for key in region_lookup_keys(normalized_label) {
        aliases.insert(key, normalized_label.to_string());
    }
}

fn built_in_region_aliases() -> HashMap<String, String> {
    let mut aliases = HashMap::new();
    for (raw_alias, label) in [
        ("50.116.1.42", "North America"),
        ("172.105.251.170", "Europe"),
        ("139.162.111.196", "Asia"),
        ("192.241.154.115", "skeld.net"),
        ("185.7.80.9", "TOU Master"),
        ("154.16.67.100", "Modded (North America)"),
        ("78.47.142.18", "Modded (Europe)"),
    ] {
        insert_region_alias(&mut aliases, raw_alias, label);
    }
    aliases
}

fn unescape_bepinex_string(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut chars = value.chars();

    while let Some(ch) = chars.next() {
        if ch != '\\' {
            result.push(ch);
            continue;
        }

        match chars.next() {
            Some('"') => result.push('"'),
            Some('\\') => result.push('\\'),
            Some('n') => result.push('\n'),
            Some('r') => result.push('\r'),
            Some('t') => result.push('\t'),
            Some(other) => result.push(other),
            None => result.push('\\'),
        }
    }

    result
}

fn extend_region_aliases_from_config(aliases: &mut HashMap<String, String>, config_contents: &str) {
    let Some(payload) = config_contents
        .lines()
        .map(str::trim)
        .find_map(|line| line.strip_prefix("Regions = "))
    else {
        return;
    };

    let Ok(parsed) = serde_json::from_str::<MiniRegionInstallPayload>(&unescape_bepinex_string(payload)) else {
        return;
    };

    for region in parsed.regions {
        let label = region.name.trim();
        if label.is_empty() {
            continue;
        }

        insert_region_alias(aliases, label, label);

        if let Some(ping_server) = region.ping_server.as_deref() {
            insert_region_alias(aliases, ping_server, label);
        }

        for server in region.servers {
            insert_region_alias(aliases, &server.ip, label);

            if let Some(port) = server.port {
                insert_region_alias(aliases, &format!("{}:{port}", server.ip.trim_end_matches('/')), label);
            }
        }
    }
}

fn region_config_candidates(process_path: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    let mut push_candidate = |path: PathBuf| {
        if path.exists() && seen.insert(path.clone()) {
            candidates.push(path);
        }
    };

    if let Some(process_path) = process_path {
        if let Some(parent) = process_path.parent() {
            push_candidate(
                parent
                    .join("BepInEx")
                    .join("config")
                    .join(MINI_REGION_INSTALL_CONFIG),
            );
        }
    }

    for drive_letter in b'A'..=b'Z' {
        for root in [
            format!("{}:\\SteamLibrary\\steamapps\\common", drive_letter as char),
            format!("{}:\\Program Files (x86)\\Steam\\steamapps\\common", drive_letter as char),
            format!("{}:\\Program Files\\Steam\\steamapps\\common", drive_letter as char),
        ] {
            let root_path = PathBuf::from(root);
            if !root_path.exists() {
                continue;
            }

            let Ok(entries) = fs::read_dir(&root_path) else {
                continue;
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with("Among Us") {
                    continue;
                }

                push_candidate(
                    path.join("BepInEx")
                        .join("config")
                        .join(MINI_REGION_INSTALL_CONFIG),
                );
            }
        }
    }

    candidates
}

pub fn load_region_aliases(process_path: Option<&Path>) -> HashMap<String, String> {
    let mut aliases = built_in_region_aliases();

    for config_path in region_config_candidates(process_path) {
        if let Ok(config_contents) = fs::read_to_string(&config_path) {
            extend_region_aliases_from_config(&mut aliases, &config_contents);
        }
    }

    aliases
}

fn resolve_region_label(server: &str, aliases: &HashMap<String, String>) -> String {
    for key in region_lookup_keys(server) {
        if let Some(label) = aliases.get(&key) {
            return label.clone();
        }
    }

    let trimmed = server.trim();
    if trimmed.is_empty() {
        "Unknown Region".to_string()
    } else {
        trimmed.to_string()
    }
}

fn detect_mod(process_path: &Path) -> &'static str {
    let path_lower = process_path.to_string_lossy().to_lowercase();
    if path_lower.contains("?\\volume") {
        return "NONE";
    }

    let Some(parent) = process_path.parent() else {
        return "NONE";
    };

    let bepinex_plugins = parent.join("BepInEx").join("plugins");
    if !parent.join("winhttp.dll").exists() || !bepinex_plugins.exists() {
        return "NONE";
    }

    let Ok(entries) = fs::read_dir(bepinex_plugins) else {
        return "NONE";
    };

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        for definition in MODS.iter().filter(|definition| definition.dll_starts_with.is_some()) {
            if let Some(prefix) = definition.dll_starts_with {
                if file_name.contains(prefix) {
                    return definition.id;
                }
            }
        }
    }

    "NONE"
}

#[cfg(windows)]
fn detect_x64_process(process: &ProcessHandle, module_base: u64) -> Result<bool, String> {
    let optional_header_offset = process.read_u32(module_base + 0x3c)? as u64;
    let optional_header_magic = process.read_u16(module_base + optional_header_offset + 0x18)?;
    Ok(optional_header_magic == 0x20b)
}

#[cfg(not(windows))]
fn detect_x64_process(_process: &ProcessHandle, _module_base: u64) -> Result<bool, String> {
    Ok(false)
}

#[cfg(windows)]
struct ProcessInfo {
    pid: u32,
    path: PathBuf,
    process: ProcessHandle,
    game_assembly: ModuleInfo,
}

#[cfg(windows)]
#[derive(Clone, Copy)]
struct ModuleInfo {
    base_address: u64,
    size: usize,
}

#[cfg(windows)]
#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PowerShellModuleInfo {
    #[serde(rename = "ModuleName")]
    _module_name: String,
    base_address: i64,
    module_memory_size: usize,
}

#[cfg(windows)]
struct ProcessHandle {
    handle: windows::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl Drop for ProcessHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

#[cfg(windows)]
impl ProcessHandle {
    fn read_bytes(&self, address: u64, len: usize) -> Result<Vec<u8>, String> {
        let mut bytes = vec![0u8; len];
        unsafe {
            windows::Win32::System::Diagnostics::Debug::ReadProcessMemory(
                self.handle,
                address as usize as *const _,
                bytes.as_mut_ptr() as *mut _,
                len,
                Some(&mut 0usize as *mut usize),
            )
            .map_err(|error| error.to_string())?;
        }
        Ok(bytes)
    }

    fn read_u8(&self, address: u64) -> Result<u8, String> {
        Ok(self.read_bytes(address, 1)?[0])
    }

    fn read_u16(&self, address: u64) -> Result<u16, String> {
        let bytes = self.read_bytes(address, 2)?;
        Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
    }

    fn read_u32(&self, address: u64) -> Result<u32, String> {
        let bytes = self.read_bytes(address, 4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn read_u64(&self, address: u64) -> Result<u64, String> {
        let bytes = self.read_bytes(address, 8)?;
        Ok(u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    fn read_i32(&self, address: u64) -> Result<i32, String> {
        let bytes = self.read_bytes(address, 4)?;
        Ok(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn read_f32(&self, address: u64) -> Result<f32, String> {
        let bytes = self.read_bytes(address, 4)?;
        Ok(f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }
}

#[cfg(not(windows))]
struct ProcessInfo {
    pid: u32,
    path: PathBuf,
    process: ProcessHandle,
    game_assembly: ModuleInfo,
}

#[cfg(not(windows))]
#[derive(Clone, Copy)]
struct ModuleInfo {
    base_address: u64,
    size: usize,
}

#[cfg(not(windows))]
struct ProcessHandle;

#[cfg(not(windows))]
impl ProcessHandle {
    fn unsupported() -> String {
        "Process memory access is only supported on Windows".to_string()
    }

    fn read_bytes(&self, _address: u64, _len: usize) -> Result<Vec<u8>, String> {
        Err(Self::unsupported())
    }

    fn read_u8(&self, _address: u64) -> Result<u8, String> {
        Err(Self::unsupported())
    }

    fn read_u16(&self, _address: u64) -> Result<u16, String> {
        Err(Self::unsupported())
    }

    fn read_u32(&self, _address: u64) -> Result<u32, String> {
        Err(Self::unsupported())
    }

    fn read_u64(&self, _address: u64) -> Result<u64, String> {
        Err(Self::unsupported())
    }

    fn read_i32(&self, _address: u64) -> Result<i32, String> {
        Err(Self::unsupported())
    }

    fn read_f32(&self, _address: u64) -> Result<f32, String> {
        Err(Self::unsupported())
    }
}

#[cfg(windows)]
fn find_among_us_process(existing_pid: Option<u32>) -> Result<Option<ProcessInfo>, String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Module32FirstW, Module32NextW, Process32FirstW, Process32NextW,
        MODULEENTRY32W, PROCESSENTRY32W, TH32CS_SNAPMODULE, TH32CS_SNAPMODULE32, TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_INFORMATION,
        PROCESS_VM_READ,
    };
    use windows::core::PWSTR;

    let snapshot =
        unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).map_err(|error| error.to_string())? };

    let mut entry = PROCESSENTRY32W::default();
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
    let mut candidates = Vec::new();

    unsafe {
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let process_name = wide_to_string(&entry.szExeFile);
                if process_name.eq_ignore_ascii_case("Among Us.exe") {
                    candidates.push(entry.th32ProcessID);
                }

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }

    if candidates.is_empty() {
        return Ok(None);
    }

    if let Some(pid) = existing_pid {
        if let Some(index) = candidates.iter().position(|candidate| *candidate == pid) {
            let existing = candidates.remove(index);
            candidates.insert(0, existing);
        }
    }

    let mut open_process_failed = false;

    for pid in candidates {
        let process = unsafe {
            OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
                .map_err(|error| error.to_string())
        };

        let Ok(handle) = process else {
            open_process_failed = true;
            continue;
        };

        let process_handle = ProcessHandle { handle };
        let module_snapshot = unsafe {
            CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid)
                .map_err(|error| error.to_string())?
        };

        let mut module_entry = MODULEENTRY32W::default();
        module_entry.dwSize = std::mem::size_of::<MODULEENTRY32W>() as u32;
        let mut game_assembly = None;

        unsafe {
            if Module32FirstW(module_snapshot, &mut module_entry).is_ok() {
                loop {
                    let module_name = wide_to_string(&module_entry.szModule);
                    if module_name.eq_ignore_ascii_case("GameAssembly.dll") {
                        game_assembly = Some(ModuleInfo {
                            base_address: module_entry.modBaseAddr as usize as u64,
                            size: module_entry.modBaseSize as usize,
                        });
                        break;
                    }

                    if Module32NextW(module_snapshot, &mut module_entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(module_snapshot);
        }

        let mut size = 1024u32;
        let mut buffer = vec![0u16; size as usize];
        unsafe {
            QueryFullProcessImageNameW(
                process_handle.handle,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            )
            .map_err(|error| error.to_string())?;
        }

        let path = PathBuf::from(String::from_utf16_lossy(&buffer[..size as usize]));
        let game_assembly = match game_assembly {
            Some(game_assembly) => Some(game_assembly),
            None => find_module_via_wow64_powershell(pid, "GameAssembly.dll")?,
        };

        let Some(game_assembly) = game_assembly else {
            continue;
        };

        return Ok(Some(ProcessInfo {
            pid,
            path,
            process: process_handle,
            game_assembly,
        }));
    }

    if open_process_failed {
        return Err(OPEN_AS_ADMINISTRATOR_ERROR.to_string());
    }

    Ok(None)
}

#[cfg(not(windows))]
fn find_among_us_process(_existing_pid: Option<u32>) -> Result<Option<ProcessInfo>, String> {
    Ok(None)
}

#[cfg(windows)]
fn wide_to_string(buffer: &[u16]) -> String {
    let end = buffer.iter().position(|value| *value == 0).unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..end])
}

#[cfg(windows)]
fn find_module_via_wow64_powershell(pid: u32, module_name: &str) -> Result<Option<ModuleInfo>, String> {
    let powershell_path = Path::new(r"C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe");
    if !powershell_path.exists() {
        return Ok(None);
    }

    let script = format!(
        "$module = (Get-Process -Id {pid} -ErrorAction Stop).Modules | Where-Object {{ $_.ModuleName -ieq '{module_name}' }} | Select-Object -First 1 @{{Name='ModuleName';Expression={{$_.ModuleName}}}}, @{{Name='BaseAddress';Expression={{$_.BaseAddress.ToInt64()}}}}, @{{Name='ModuleMemorySize';Expression={{$_.ModuleMemorySize}}}}; if ($module) {{ $module | ConvertTo-Json -Compress }}"
    );

    let output = std::process::Command::new(powershell_path)
        .args(["-NoProfile", "-Command", script.as_str()])
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        debug_log(&format!(
            "powershell module lookup failed pid={} module={} status={:?}",
            pid, module_name, output.status.code()
        ));
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        debug_log(&format!(
            "powershell module lookup empty pid={} module={}",
            pid, module_name
        ));
        return Ok(None);
    }

    let module: PowerShellModuleInfo =
        serde_json::from_str(&stdout).map_err(|error| error.to_string())?;

    debug_log(&format!(
        "powershell module lookup hit pid={} module={} base=0x{:X} size={}",
        pid,
        module_name,
        module.base_address.max(0) as u64,
        module.module_memory_size
    ));

    Ok(Some(ModuleInfo {
        base_address: module.base_address.max(0) as u64,
        size: module.module_memory_size,
    }))
}

fn debug_log(message: &str) {
    let Some(path) = env::var_os("BCL_DEBUG_LOG") else {
        return;
    };

    let timestamp = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration.as_secs_f64(),
        Err(_) => 0.0,
    };

    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(PathBuf::from(path))
    {
        let _ = writeln!(file, "[{timestamp:.3}] {message}");
    }
}
