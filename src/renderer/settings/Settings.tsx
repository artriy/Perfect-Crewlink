import React, { ReactChild, useCallback, useContext, useEffect, useReducer, useState } from 'react';
import { SettingsContext, GameStateContext, HostSettingsContext } from '../contexts';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';
import { AleLuduColumnTuning, AleLuduTuning, ISettings, ILobbySettings } from '../../common/ISettings';
import makeStyles from '@mui/styles/makeStyles';
import withStyles from '@mui/styles/withStyles';
import {
	RadioGroup,
	Checkbox,
	FormControlLabel,
	Box,
	Typography,
	IconButton,
	Button,
	Radio,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { DialogContent, DialogContentText, DialogActions, DialogTitle, Slider, Tooltip } from '@mui/material';
import { Dialog, TextField } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import { GameState } from '../../common/AmongUsState';
import { getSystemLocale } from '../../common/tauri-system';
import { bridge } from '../bridge';
import { IpcHandlerMessages } from '../../common/ipc-messages';
import i18next, { TFunction } from 'i18next';
import languages from '../language/languages';
import ServerURLInput from './ServerURLInput';
import MuiDivider from '@mui/material/Divider';
import PublicLobbySettings from './PublicLobbySettings';
import SettingsStore, { pushToTalkOptions, setSetting } from './SettingsStore';

interface StyleInput {
	open: boolean;
}

const Divider = withStyles((theme) => ({
	root: {
		width: '100%',
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
}))(MuiDivider);

const useStyles = makeStyles((theme) => ({
	root: {
		width: '100vw',
		height: `calc(100vh - ${theme.spacing(3)})`,
		background: '#171717ad',
		backdropFilter: 'blur(4px)',
		position: 'absolute',
		left: 0,
		top: 0,
		zIndex: 99,
		alignItems: 'center',
		marginTop: theme.spacing(3),
		transition: 'transform .1s ease-in-out',
		WebkitAppRegion: 'no-drag',
		transform: ({ open }: StyleInput) => (open ? 'translateX(0)' : 'translateX(-100%)'),
	},
	header: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	scroll: {
		paddingTop: theme.spacing(1),
		paddingLeft: theme.spacing(2),
		paddingRight: theme.spacing(2),
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'center',
		paddingBottom: theme.spacing(7),
		height: `calc(100vh - 40px - ${theme.spacing(7 + 3 + 3)})`,
	},
	shortcutField: {
		marginTop: theme.spacing(1),
	},
	back: {
		cursor: 'pointer',
		position: 'absolute',
		right: theme.spacing(1),
		WebkitAppRegion: 'no-drag',
	},
	alert: {
		position: 'absolute',
		bottom: theme.spacing(1),
		zIndex: 10,
	},
	dialog: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'start',
		'&>*': {
			marginBottom: theme.spacing(1),
		},
	},
	formLabel: {
		width: '100%',
		borderTop: '1px solid #313135',
		marginRight: '0px',
		// paddingBottom:'5px'
	},
}));

const keys = new Set([
	'CapsLock',
	'Space',
	'Backspace',
	'Delete',
	'Enter',
	'Up',
	'Down',
	'Left',
	'Right',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	'Escape',
	'LShift',
	'RShift',
	'RAlt',
	'LAlt',
	'RControl',
	'LControl',
]);

export interface SettingsProps {
	t: TFunction;
	open: boolean;
	onClose: () => void;
}

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

interface DisabledTooltipProps {
	disabled: boolean;
	title: string;
	children: ReactChild;
}

interface IConfirmDialog {
	confirmCallback?: () => void;
	description?: string;
	title?: string;
	open: boolean;
}

const DisabledTooltip: React.FC<DisabledTooltipProps> = function ({ disabled, children, title }: DisabledTooltipProps) {
	if (disabled)
		return (
			<Tooltip placement="top" arrow title={title}>
				<span>{children}</span>
			</Tooltip>
		);
	else return <>{children}</>;
};

const ALE_LUDU_COLUMN_COUNT = 4;

// Hand-calibrated per-column defaults from the live overlay session — centres are
// non-uniform so derive-from-pitch would miss by ~1%. Keep in sync with
// BASE_ALE_LUDU_COLUMNS in Overlay.tsx and buildDefaultColumns in SettingsStore.tsx.
const DEFAULT_ALE_LUDU_COLUMN_TUNING: AleLuduColumnTuning[] = [
	{ centerPct: 13.8, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 38.3, widthPct: 22.5, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 62.4, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 86.9, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
];

const DEFAULT_ALE_LUDU_TUNING: AleLuduTuning = {
	col0CenterPct: 13.8,
	colPitchPct: 24.0,
	colWidthPct: 22.6,
	row0CenterPct: 5.0,
	rowHeight: 10.0,
	rowGap: 2.4,
	showDebug: false,
	columns: DEFAULT_ALE_LUDU_COLUMN_TUNING.map((c) => ({ ...c })),
	mhLeftPct: 8.05,
	mhTopPct: 11.95,
	mhWidthPct: 83.9,
	mhHeightPct: 76.1,
	tabletLeftPct: 0.0,
	tabletTopPct: 12.0,
	tabletWidthPct: 100.0,
	tabletHeightPct: 100.0,
};

interface AleLuduTuningPanelProps {
	settings: ISettings;
	setSettings: typeof setSetting;
}

type NumericTuningKey = keyof Omit<AleLuduTuning, 'showDebug' | 'columns'>;

interface TuningField {
	key: NumericTuningKey;
	label: string;
	step: number;
	min: number;
	max: number;
}

// Size maxes are intentionally generous so users can push the tablet HUD well past
// the vanilla rect — the overlay is additive and letterboxing makes the raw % range
// meaningful on ultra-wide / 4K setups where 100% of viewport isn't enough.
const MEETING_HUD_FIELDS: TuningField[] = [
	{ key: 'mhLeftPct', label: 'MeetingHud left (% of viewport)', step: 0.1, min: -50, max: 200 },
	{ key: 'mhTopPct', label: 'MeetingHud top (% of viewport)', step: 0.1, min: -50, max: 200 },
	{ key: 'mhWidthPct', label: 'MeetingHud width (% of viewport)', step: 0.1, min: 1, max: 200 },
	{ key: 'mhHeightPct', label: 'MeetingHud height (% of viewport)', step: 0.1, min: 1, max: 200 },
];

const TABLET_FIELDS: TuningField[] = [
	{ key: 'tabletLeftPct', label: 'Tablet left (% of meetingHud)', step: 0.1, min: -100, max: 200 },
	{ key: 'tabletTopPct', label: 'Tablet top (% of meetingHud)', step: 0.1, min: -100, max: 200 },
	{ key: 'tabletWidthPct', label: 'Tablet width (% of meetingHud)', step: 0.1, min: 1, max: 400 },
	{ key: 'tabletHeightPct', label: 'Tablet height (% of meetingHud)', step: 0.1, min: 1, max: 400 },
];

// Legacy global tile fields — shown for backwards compatibility but the per-column
// panel below overrides them.
const TILE_FIELDS: TuningField[] = [
	{ key: 'col0CenterPct', label: 'Col 0 center (%)', step: 0.1, min: 0, max: 200 },
	{ key: 'colPitchPct', label: 'Col pitch (%)', step: 0.1, min: 0, max: 200 },
	{ key: 'colWidthPct', label: 'Col width (%)', step: 0.1, min: 0, max: 200 },
	{ key: 'row0CenterPct', label: 'Row 0 center (%)', step: 0.1, min: 0, max: 200 },
	{ key: 'rowHeight', label: 'Row height (%)', step: 0.1, min: 0, max: 150 },
	{ key: 'rowGap', label: 'Row gap (%)', step: 0.1, min: 0, max: 100 },
];

interface ColumnTuningField {
	key: keyof AleLuduColumnTuning;
	label: string;
	step: number;
	min: number;
	max: number;
}

const COLUMN_TUNING_FIELDS: ColumnTuningField[] = [
	{ key: 'centerPct', label: 'Center (%)', step: 0.1, min: -50, max: 200 },
	{ key: 'widthPct', label: 'Width (%)', step: 0.1, min: 0, max: 200 },
	{ key: 'row0CenterPct', label: 'Row 0 center (%)', step: 0.1, min: -50, max: 200 },
	{ key: 'rowHeight', label: 'Row height (%)', step: 0.1, min: 0, max: 150 },
	{ key: 'rowGap', label: 'Row gap (%)', step: 0.1, min: 0, max: 100 },
];

function ensureColumns(tuning: AleLuduTuning): AleLuduColumnTuning[] {
	const source = tuning.columns ?? [];
	return Array.from({ length: ALE_LUDU_COLUMN_COUNT }, (_, i) => {
		const existing = source[i];
		const fallback = DEFAULT_ALE_LUDU_COLUMN_TUNING[i];
		if (!existing) return { ...fallback };
		return {
			centerPct: typeof existing.centerPct === 'number' ? existing.centerPct : fallback.centerPct,
			widthPct: typeof existing.widthPct === 'number' ? existing.widthPct : fallback.widthPct,
			row0CenterPct: typeof existing.row0CenterPct === 'number' ? existing.row0CenterPct : fallback.row0CenterPct,
			rowHeight: typeof existing.rowHeight === 'number' ? existing.rowHeight : fallback.rowHeight,
			rowGap: typeof existing.rowGap === 'number' ? existing.rowGap : fallback.rowGap,
		};
	});
}

const AleLuduTuningPanel: React.FC<AleLuduTuningPanelProps> = function ({
	settings,
	setSettings,
}: AleLuduTuningPanelProps) {
	const tuning: AleLuduTuning = settings.aleLuduTuning ?? DEFAULT_ALE_LUDU_TUNING;
	const columns = ensureColumns(tuning);
	// Start with every column accordion expanded so per-column controls are visible
	// immediately — the old single-expand UI hid the fact that each column already has
	// its own independent settings, which made it look like only global knobs existed.
	const [expandedColumns, setExpandedColumns] = useState<Set<number>>(
		() => new Set(Array.from({ length: ALE_LUDU_COLUMN_COUNT }, (_, i) => i))
	);
	const toggleColumnExpanded = (index: number) => {
		setExpandedColumns((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};
	const expandAllColumns = () =>
		setExpandedColumns(new Set(Array.from({ length: ALE_LUDU_COLUMN_COUNT }, (_, i) => i)));
	const collapseAllColumns = () => setExpandedColumns(new Set());

	const writeTuning = (next: AleLuduTuning) => {
		setSettings('aleLuduTuning', next);
	};
	const updateField = (key: keyof AleLuduTuning, value: AleLuduTuning[keyof AleLuduTuning]) => {
		writeTuning({ ...tuning, [key]: value });
	};
	const updateColumn = (index: number, key: keyof AleLuduColumnTuning, value: number) => {
		const nextColumns = columns.map((col, i) => (i === index ? { ...col, [key]: value } : col));
		writeTuning({ ...tuning, columns: nextColumns });
	};
	const resetColumn = (index: number) => {
		const nextColumns = columns.map((col, i) =>
			i === index ? { ...DEFAULT_ALE_LUDU_COLUMN_TUNING[index] } : col
		);
		writeTuning({ ...tuning, columns: nextColumns });
	};
	const copyColumnToAll = (index: number) => {
		const source = columns[index];
		// Preserve each column's own centerPct (otherwise all columns would stack) —
		// only clone the size / row shape so "copy to all" means "same dimensions everywhere".
		const nextColumns = columns.map((col) => ({
			centerPct: col.centerPct,
			widthPct: source.widthPct,
			row0CenterPct: source.row0CenterPct,
			rowHeight: source.rowHeight,
			rowGap: source.rowGap,
		}));
		writeTuning({ ...tuning, columns: nextColumns });
	};
	const distributeColumnsEvenly = () => {
		const widthPct = columns[0]?.widthPct ?? 20;
		const spacing = 100 / ALE_LUDU_COLUMN_COUNT;
		const nextColumns = columns.map((col, i) => ({
			...col,
			centerPct: spacing / 2 + i * spacing,
			widthPct,
		}));
		writeTuning({ ...tuning, columns: nextColumns });
	};

	const renderFieldGroup = (fields: TuningField[]) => (
		<Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 1.5 }}>
			{fields.map((field) => (
				<TextField
					key={field.key}
					label={field.label}
					type="number"
					size="small"
					variant="outlined"
					color="secondary"
					value={tuning[field.key]}
					inputProps={{ step: field.step, min: field.min, max: field.max }}
					onChange={(ev) => {
						const raw = ev.target.value;
						if (raw === '' || raw === '-') return;
						const num = Number(raw);
						if (!Number.isFinite(num)) return;
						updateField(field.key, num);
					}}
				/>
			))}
		</Box>
	);

	const renderColumnPanel = (index: number) => {
		const column = columns[index];
		const isOpen = expandedColumns.has(index);
		return (
			<Box
				key={`ale-ludu-col-${index}`}
				sx={{
					border: '1px solid rgba(255,255,255,0.08)',
					borderRadius: 1,
					marginBottom: 1,
					background: 'rgba(255,255,255,0.02)',
				}}
			>
				<Box
					onClick={() => toggleColumnExpanded(index)}
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '6px 10px',
						cursor: 'pointer',
						userSelect: 'none',
					}}
				>
					<Typography variant="subtitle2">
						Column {index} — center {column.centerPct.toFixed(1)}% · width {column.widthPct.toFixed(1)}%
					</Typography>
					<Typography variant="caption" sx={{ opacity: 0.6 }}>
						{isOpen ? '▾' : '▸'}
					</Typography>
				</Box>
				{isOpen && (
					<Box sx={{ padding: 1.25, paddingTop: 0 }}>
						<Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 1 }}>
							{COLUMN_TUNING_FIELDS.map((field) => (
								<TextField
									key={`col-${index}-${field.key}`}
									label={field.label}
									type="number"
									size="small"
									variant="outlined"
									color="secondary"
									value={column[field.key]}
									inputProps={{ step: field.step, min: field.min, max: field.max }}
									onChange={(ev) => {
										const raw = ev.target.value;
										if (raw === '' || raw === '-') return;
										const num = Number(raw);
										if (!Number.isFinite(num)) return;
										updateColumn(index, field.key, num);
									}}
								/>
							))}
						</Box>
						<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
							<Button
								size="small"
								variant="outlined"
								color="secondary"
								onClick={() => resetColumn(index)}
							>
								Reset column {index}
							</Button>
							<Button
								size="small"
								variant="outlined"
								color="secondary"
								onClick={() => copyColumnToAll(index)}
							>
								Copy size to all columns
							</Button>
						</Box>
					</Box>
				)}
			</Box>
		);
	};

	return (
		<Box
			sx={{
				width: '100%',
				marginTop: 1,
				padding: 1.5,
				border: '1px solid rgba(255,255,255,0.12)',
				borderRadius: 1,
				background: 'rgba(255,255,255,0.03)',
			}}
		>
			<Typography variant="caption" sx={{ display: 'block', opacity: 0.7, marginBottom: 1 }}>
				AleLudu calibration — live tuning. Changes apply instantly to the meeting overlay.
			</Typography>
			<FormControlLabel
				label="Show calibration grid (magenta) on meeting overlay"
				checked={tuning.showDebug}
				onChange={(_, checked: boolean) => updateField('showDebug', checked)}
				control={<Checkbox size="small" />}
				sx={{ marginBottom: 1 }}
			/>

			<Typography variant="subtitle2" sx={{ marginTop: 0.5, marginBottom: 0.5 }}>
				Meeting HUD rect (red outline)
			</Typography>
			{renderFieldGroup(MEETING_HUD_FIELDS)}

			<Typography variant="subtitle2" sx={{ marginTop: 0.5, marginBottom: 0.5 }}>
				Tablet rect (yellow outline) — within meetingHud
			</Typography>
			{renderFieldGroup(TABLET_FIELDS)}

			<Typography variant="subtitle2" sx={{ marginTop: 0.5, marginBottom: 0.5 }}>
				Per-column tile layout — each column is independent
			</Typography>
			<Box sx={{ marginBottom: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
				<Button
					size="small"
					variant="outlined"
					color="secondary"
					onClick={distributeColumnsEvenly}
				>
					Distribute columns evenly
				</Button>
				<Button
					size="small"
					variant="outlined"
					color="secondary"
					onClick={expandAllColumns}
				>
					Expand all
				</Button>
				<Button
					size="small"
					variant="outlined"
					color="secondary"
					onClick={collapseAllColumns}
				>
					Collapse all
				</Button>
			</Box>
			{columns.map((_, i) => renderColumnPanel(i))}

			<Typography variant="subtitle2" sx={{ marginTop: 1.5, marginBottom: 0.5, opacity: 0.7 }}>
				Legacy global tile fields (fallback when per-column values missing)
			</Typography>
			{renderFieldGroup(TILE_FIELDS)}

			<Button
				size="small"
				variant="outlined"
				color="secondary"
				sx={{ marginTop: 0.5 }}
				onClick={() => writeTuning({
					...DEFAULT_ALE_LUDU_TUNING,
					columns: DEFAULT_ALE_LUDU_COLUMN_TUNING.map((c) => ({ ...c })),
				})}
			>
				Reset all to defaults
			</Button>
		</Box>
	);
};

const Settings: React.FC<SettingsProps> = function ({ t, open, onClose }: SettingsProps) {
	const classes = useStyles({ open });
	const [settings, setSettings, setLobbySettings] = useContext(SettingsContext);
	const gameState = useContext(GameStateContext);
	const [hostLobbySettings] = useContext(HostSettingsContext);
	const [unsavedCount, setUnsavedCount] = useState(0);
	const unsaved = unsavedCount > 1;

	// Used to buffer changes that are only sent out on settings close
	const [localLobbySettingsBuffer, setLocalLobbySettingsBuffer] = useState(settings.localLobbySettings);
	const updateLocalLobbySettingsBuffer = (newValues: Partial<ILobbySettings>) => setLocalLobbySettingsBuffer((oldState) => { return { ...oldState, ...newValues } });
	const applyLobbySettings = useCallback((newValues: Partial<ILobbySettings>) => {
		updateLocalLobbySettingsBuffer(newValues);
		for (const [setting, value] of Object.entries(newValues) as [keyof ILobbySettings, ILobbySettings[keyof ILobbySettings]][]) {
			setLobbySettings(setting, value);
		}
	}, []);

	useEffect(() => {
		setUnsavedCount((s) => s + 1);
	}, [
		settings.microphone,
		settings.speaker,
		settings.serverURL,
		settings.vadEnabled,
		settings.hardware_acceleration,
		settings.natFix,
		settings.noiseSuppression,
		settings.oldSampleDebug,
		settings.echoCancellation,
		settings.mobileHost,
		settings.microphoneGainEnabled,
		settings.micSensitivityEnabled,
	]);

	useEffect(() => {
		bridge.send('setAlwaysOnTop', settings.alwaysOnTop);
	}, [settings.alwaysOnTop]);

	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices().then((devices) =>
			setDevices(
				devices.map((d) => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = t('buttons.default');
					} else {
						const match = /.+?\([^(]+\)/.exec(d.label);
						if (match && match[0]) label = match[0];
					}
					return {
						id: d.deviceId,
						kind: d.kind,
						label,
					};
				})
			)
		);
	}, [_]);

	const setShortcut = (ev: React.KeyboardEvent, shortcut: keyof ISettings) => {
		let k = ev.key;
		if (k.length === 1) k = k.toUpperCase();
		else if (k.startsWith('Arrow')) k = k.substring(5);
		if (k === ' ') k = 'Space';

		/* @ts-ignore */
		const c = ev.code as string;
		if (c && c.startsWith('Numpad')) {
			k = c;
		}

		if (k === 'Control' || k === 'Alt' || k === 'Shift') k = (ev.location === 1 ? 'L' : 'R') + k;

		if (/^[0-9A-Z]$/.test(k) || /^F[0-9]{1,2}$/.test(k) || keys.has(k) || k.startsWith('Numpad')) {
			if (k === 'Escape') {
				console.log('disable??');
				k = 'Disabled';
			}
			setSettings(shortcut, k);

			bridge.send(IpcHandlerMessages.RESET_KEYHOOKS);
		}
	};

	const setMouseShortcut = (ev: React.MouseEvent<HTMLDivElement>, shortcut: keyof ISettings) => {
		if (ev.button > 2) {
			// this makes our button start at 1 instead of 0
			// React Mouse event starts at 0, but IOHooks starts at 1
			const k = `MouseButton${ev.button + 1}`;
			setSettings(shortcut, k);
			bridge.send(IpcHandlerMessages.RESET_KEYHOOKS);
		}
	};

	const resetDefaults = () => {
		SettingsStore.clear();
		// This is necessary for resetting hotkeys properly, the main thread needs to be notified to reset the hooks
		bridge.send(IpcHandlerMessages.RESET_KEYHOOKS);

		location.reload();
	};

	const microphones = devices.filter((d) => d.kind === 'audioinput');
	const speakers = devices.filter((d) => d.kind === 'audiooutput');

	useEffect(() => {
		(async () => {
			console.log(settings.language);
			if (settings.language === 'unkown') {
				const locale: string = await getSystemLocale();
				const lang = Object.keys(languages).includes(locale)
					? locale
					: Object.keys(languages).includes(locale.split('-')[0])
						? locale.split('-')[0]
						: undefined;
				if (lang) {
					settings.language = lang;
					setSettings('language', settings.language);
				}
			}
			i18next.changeLanguage(settings.language);
		})();
	}, [settings.language]);

	const isInMenuOrLobby = gameState?.gameState === GameState.LOBBY || gameState?.gameState === GameState.MENU;
	const canChangeLobbySettings =
		gameState?.gameState === GameState.MENU || (gameState?.isHost && gameState?.gameState === GameState.LOBBY);
	const canResetSettings =
		gameState?.gameState === undefined ||
		!gameState?.isHost ||
		gameState.gameState === GameState.MENU ||
		gameState.gameState === GameState.LOBBY;

	const [warningDialog, setWarningDialog] = React.useState({ open: false } as IConfirmDialog);

	const handleWarningDialogClose = (confirm: boolean) => {
		if (confirm && warningDialog.confirmCallback) {
			warningDialog.confirmCallback();
		}
		setWarningDialog({ open: false });
	};

	const openWarningDialog = (
		dialogTitle: string,
		dialogDescription: string,
		confirmCallback?: () => void,
		showDialog?: boolean
	) => {
		if (!showDialog) {
			if (confirmCallback) confirmCallback();
		} else {
			setWarningDialog({ title: dialogTitle, description: dialogDescription, open: true, confirmCallback });
		}
	};

	const URLInputCallback = useCallback((url: string) => {
		setSettings('serverURL', url);
	}, []);

	const SavePublicLobbyCallback = useCallback(<K extends keyof ILobbySettings>(setting: K, newValue: ILobbySettings[K]) => {
		const newSetting: Partial<ILobbySettings> = {};
		newSetting[setting] = newValue;
		applyLobbySettings(newSetting);
	}, []);

	if (!open) { return <></> }

	return (
		<Box className={classes.root}>
			<div className={classes.header}>
				<IconButton
					className={classes.back}
					size="small"
					onClick={() => {
						setSettings('localLobbySettings', localLobbySettingsBuffer);
						if (unsaved) {
							onClose();
							location.reload();
						} else onClose();
					}}
				>
					<ChevronLeft htmlColor="#777" />
				</IconButton>
				<Typography variant="h6">{t('settings.title')}</Typography>
			</div>
			<div className={classes.scroll}>
				{/* Lobby Settings */}
				<div>
					<Dialog
						open={warningDialog.open}
						onClose={handleWarningDialogClose}
						aria-labelledby="alert-dialog-title"
						aria-describedby="alert-dialog-description"
					>
						<DialogTitle id="alert-dialog-title">{warningDialog.title}</DialogTitle>
						<DialogContent>
							<DialogContentText id="alert-dialog-description">{warningDialog.description}</DialogContentText>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => handleWarningDialogClose(true)} color="primary">
								{t('buttons.confirm')}
							</Button>
							<Button onClick={() => handleWarningDialogClose(false)} color="primary" autoFocus>
								{t('buttons.cancel')}
							</Button>
						</DialogActions>
					</Dialog>
				</div>

				<Typography variant="h6">{t('settings.lobbysettings.title')}</Typography>
				<div>
					<Typography id="input-slider" gutterBottom>
						{(canChangeLobbySettings ? localLobbySettingsBuffer.visionHearing : hostLobbySettings.visionHearing)
							? t('settings.lobbysettings.voicedistance_impostor')
							: t('settings.lobbysettings.voicedistance')}
						: {canChangeLobbySettings ? localLobbySettingsBuffer.maxDistance.toFixed(1) : hostLobbySettings.maxDistance.toFixed(1)}
					</Typography>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<Slider
							size="small"
							disabled={!canChangeLobbySettings}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.maxDistance : hostLobbySettings.maxDistance}
							min={1}
							max={10}
							step={0.1}
							onChange={(_, newValue: number | number[]) => applyLobbySettings({ maxDistance: newValue as number })}
						/>
					</DisabledTooltip>
				</div>
				<div>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.public_lobby.enabled')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								openWarningDialog(
									t('settings.warning'),
									t('settings.lobbysettings.public_lobby.enable_warning'),
									() => applyLobbySettings({ publicLobby_on: newValue }),
									!localLobbySettingsBuffer.publicLobby_on
								);
							}}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.publicLobby_on : hostLobbySettings.publicLobby_on}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.publicLobby_on : hostLobbySettings.publicLobby_on}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<PublicLobbySettings
							t={t}
							updateSetting={SavePublicLobbyCallback}
							lobbySettings={canChangeLobbySettings ? localLobbySettingsBuffer : hostLobbySettings}
							canChange={canChangeLobbySettings}
							className={classes.dialog}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.wallsblockaudio')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ wallsBlockAudio: newValue })}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.wallsBlockAudio : hostLobbySettings.wallsBlockAudio}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.wallsBlockAudio : hostLobbySettings.wallsBlockAudio}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.visiononly')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ visionHearing: newValue })}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.visionHearing : hostLobbySettings.visionHearing}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.visionHearing : hostLobbySettings.visionHearing}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.impostorshearsghost')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ haunting: newValue })}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.haunting : hostLobbySettings.haunting}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.haunting : hostLobbySettings.haunting}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.hear_imposters_invents')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ hearImpostorsInVents: newValue })}
							value={
								canChangeLobbySettings ? localLobbySettingsBuffer.hearImpostorsInVents : hostLobbySettings.hearImpostorsInVents
							}
							checked={
								canChangeLobbySettings ? localLobbySettingsBuffer.hearImpostorsInVents : hostLobbySettings.hearImpostorsInVents
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.private_talk_invents')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ impostersHearImpostersInvent: newValue })}
							value={
								canChangeLobbySettings
									? localLobbySettingsBuffer.impostersHearImpostersInvent
									: hostLobbySettings.impostersHearImpostersInvent
							}
							checked={
								canChangeLobbySettings
									? localLobbySettingsBuffer.impostersHearImpostersInvent
									: hostLobbySettings.impostersHearImpostersInvent
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>

					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.comms_sabotage_audio')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ commsSabotage: newValue })}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.commsSabotage : hostLobbySettings.commsSabotage}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.commsSabotage : hostLobbySettings.commsSabotage}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.hear_through_cameras')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ hearThroughCameras: newValue })}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.hearThroughCameras : hostLobbySettings.hearThroughCameras}
							checked={
								canChangeLobbySettings ? localLobbySettingsBuffer.hearThroughCameras : hostLobbySettings.hearThroughCameras
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.impostor_radio')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => applyLobbySettings({ impostorRadioEnabled: newValue })}
							value={
								canChangeLobbySettings ? localLobbySettingsBuffer.impostorRadioEnabled : hostLobbySettings.impostorRadioEnabled
							}
							checked={
								canChangeLobbySettings ? localLobbySettingsBuffer.impostorRadioEnabled : hostLobbySettings.impostorRadioEnabled
							}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.ghost_only')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								console.log('new vlaue of setting: ', newValue);
								openWarningDialog(
									t('settings.warning'),
									t('settings.lobbysettings.ghost_only_warning'),
									() => applyLobbySettings({ meetingGhostOnly: false, deadOnly: newValue }),
									newValue
								);
							}}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.deadOnly : hostLobbySettings.deadOnly}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.deadOnly : hostLobbySettings.deadOnly}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={isInMenuOrLobby ? t('settings.lobbysettings.gamehostonly') : t('settings.lobbysettings.inlobbyonly')}
					>
						<FormControlLabel
							className={classes.formLabel}
							label={t('settings.lobbysettings.meetings_only')}
							disabled={!canChangeLobbySettings}
							onChange={(_, newValue: boolean) => {
								console.log('new vlaue of setting: ', newValue);
								openWarningDialog(
									t('settings.warning'),
									t('settings.lobbysettings.meetings_only_warning'),
									() => applyLobbySettings({ meetingGhostOnly: newValue, deadOnly: false }),
									newValue
								);
							}}
							value={canChangeLobbySettings ? localLobbySettingsBuffer.meetingGhostOnly : hostLobbySettings.meetingGhostOnly}
							checked={canChangeLobbySettings ? localLobbySettingsBuffer.meetingGhostOnly : hostLobbySettings.meetingGhostOnly}
							control={<Checkbox />}
						/>
					</DisabledTooltip>
					{/* </FormGroup> */}
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.audio.title')}</Typography>
				<TextField
					select
					label={t('settings.audio.microphone')}
					variant="outlined"
					color="secondary"
					value={settings.microphone}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => setSettings('microphone', ev.target.value)}
					onClick={updateDevices}
				>
					{microphones.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <MicrophoneSoundBar microphone={settings.microphone} />}
				<TextField
					select
					label={t('settings.audio.speaker')}
					variant="outlined"
					color="secondary"
					value={settings.speaker}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => setSettings('speaker', ev.target.value)}
					onClick={updateDevices}
				>
					{speakers.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <TestSpeakersButton t={t} speaker={settings.speaker} />}
				<RadioGroup
					value={settings.pushToTalkMode}
					onChange={(ev) => {
						setSettings('pushToTalkMode', Number(ev.target.value));
					}}
				>
					<FormControlLabel
						label={t('settings.audio.voice_activity')}
						value={pushToTalkOptions.VOICE}
						control={<Radio />}
					/>
					<FormControlLabel
						label={t('settings.audio.push_to_talk')}
						value={pushToTalkOptions.PUSH_TO_TALK}
						control={<Radio />}
					/>
					<FormControlLabel
						label={t('settings.audio.push_to_mute')}
						value={pushToTalkOptions.PUSH_TO_MUTE}
						control={<Radio />}
					/>
				</RadioGroup>
				<Divider />

				<div>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.microphone_volume')}
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={3}>
							<Checkbox
								checked={settings.microphoneGainEnabled}
								onChange={(_, checked: boolean) => setSettings('microphoneGainEnabled', checked)}
							/>
						</Grid>
						<Grid
							item
							xs={8}
							style={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<Slider
								size="small"
								disabled={!settings.microphoneGainEnabled}
								value={settings.microphoneGain}
								valueLabelDisplay="auto"
								min={0}
								max={300}
								step={2}
								onChange={(_, newValue: number | number[]) => setSettings('microphoneGain', newValue as number)}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.microphone_sens')}
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={3}>
							<Checkbox
								checked={settings.micSensitivityEnabled}
								onChange={(_, checked: boolean) => setSettings('micSensitivityEnabled', checked)}
							/>
						</Grid>
						<Grid
							item
							xs={8}
							style={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<Slider
								size="small"
								disabled={!settings.micSensitivityEnabled}
								value={+(1 - settings.micSensitivity).toFixed(2)}
								valueLabelDisplay="auto"
								min={0}
								max={1}
								color={settings.micSensitivity < 0.3 ? 'primary' : 'secondary'}
								step={0.05}
								onChange={(_, newValue: number | number[]) => {
									openWarningDialog(
										t('settings.warning'),
										t('settings.audio.microphone_sens_warning'),
										() => setSettings('micSensitivity', 1 - (newValue as number)),
										newValue == 0.7 && settings.micSensitivity < 0.3
									);
								}}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Divider />

					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.mastervolume')}
					</Typography>
					<Grid container direction="row" justifyContent="center" alignItems="center">
						<Grid item xs={11}>
							<Slider
								size="small"
								value={settings.masterVolume}
								valueLabelDisplay="auto"
								max={200}
								onChange={(_, newValue: number | number[]) => setSettings('masterVolume', newValue as number)}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.crewvolume')}
					</Typography>
					<Grid container direction="row" justifyContent="center" alignItems="center">
						<Grid item xs={11}>
							<Slider
								size="small"
								value={settings.crewVolumeAsGhost}
								valueLabelDisplay="auto"
								onChange={(_, newValue: number | number[]) => setSettings('crewVolumeAsGhost', newValue as number)}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
					<Typography id="input-slider" gutterBottom>
						{t('settings.audio.ghostvolumeasimpostor')}
					</Typography>
					<Grid container direction="row" justifyContent="center" alignItems="center">
						<Grid item xs={11}>
							<Slider
								size="small"
								value={settings.ghostVolumeAsImpostor}
								valueLabelDisplay="auto"
								onChange={(_, newValue: number | number[]) => setSettings('ghostVolumeAsImpostor', newValue as number)}
								aria-labelledby="input-slider"
							/>
						</Grid>
					</Grid>
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.keyboard.title')}</Typography>
				<Grid container spacing={1}>
					<Grid item xs={6}>
						<TextField
							fullWidth
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.push_to_talk')}
							value={settings.pushToTalkShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'pushToTalkShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'pushToTalkShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.impostor_radio')}
							value={settings.impostorRadioShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'impostorRadioShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'impostorRadioShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.mute')}
							value={settings.muteShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'muteShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'muteShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label={t('settings.keyboard.deafen')}
							value={settings.deafenShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'deafenShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'deafenShortcut');
							}}
						/>
					</Grid>
				</Grid>

				<Divider />
				<Typography variant="h6">{t('settings.overlay.title')}</Typography>
				<div>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.overlay.always_on_top')}
						checked={settings.alwaysOnTop}
						onChange={(_, checked: boolean) => setSettings('alwaysOnTop', checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.overlay.enabled')}
						checked={settings.enableOverlay}
						onChange={(_, checked: boolean) => setSettings('enableOverlay', checked)}
						control={<Checkbox />}
					/>
					{settings.enableOverlay && (
						<>
							<FormControlLabel
								className={classes.formLabel}
								label={t('settings.overlay.compact')}
								checked={settings.compactOverlay}
								onChange={(_, checked: boolean) => setSettings('compactOverlay', checked)}
								control={<Checkbox />}
							/>
							<FormControlLabel
								className={classes.formLabel}
								label={t('settings.overlay.show_all_players')}
								checked={settings.alwaysShowOverlayPlayers}
								onChange={(_, checked: boolean) => setSettings('alwaysShowOverlayPlayers', checked)}
								control={<Checkbox />}
							/>
							<FormControlLabel
								className={classes.formLabel}
								label={t('settings.overlay.meeting')}
								checked={settings.meetingOverlay}
								onChange={(_, checked: boolean) => setSettings('meetingOverlay', checked)}
								control={<Checkbox />}
							/>
							<FormControlLabel
								className={classes.formLabel}
								label={t('settings.overlay.aleludu_mode')}
								checked={settings.aleLuduMode}
								onChange={(_, checked: boolean) => setSettings('aleLuduMode', checked)}
								control={<Checkbox />}
							/>
							{settings.aleLuduMode && (
								<AleLuduTuningPanel settings={settings} setSettings={setSettings} />
							)}
							<TextField
								fullWidth
								select
								label={t('settings.overlay.pos')}
								variant="outlined"
								color="secondary"
								value={settings.overlayPosition}
								className={classes.shortcutField}
								SelectProps={{ native: true }}
								InputLabelProps={{ shrink: true }}
								onChange={(ev) => setSettings('overlayPosition', ev.target.value)}
								onClick={updateDevices}
							>
								<option value="hidden">{t('settings.overlay.locations.hidden')}</option>
								<option value="top">{t('settings.overlay.locations.top')}</option>
								<option value="top1">{t('settings.overlay.locations.top1')}</option>
								<option value="bottom_left">{t('settings.overlay.locations.bottom')}</option>
								<option value="right">{t('settings.overlay.locations.right')}</option>
								<option value="right1">{t('settings.overlay.locations.right1')}</option>
								<option value="left">{t('settings.overlay.locations.left')}</option>
								<option value="left1">{t('settings.overlay.locations.left1')}</option>
							</TextField>
						</>
					)}
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.advanced.title')}</Typography>
				<div>
					<FormControlLabel
						label={t('settings.advanced.nat_fix')}
						checked={settings.natFix}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.advanced.nat_fix_warning'),
								() => setSettings('natFix', checked),
								checked
							);
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.advanced.ignore_incompatible_lobby_browser_mods')}
						checked={settings.ignoreIncompatibleLobbyBrowserMods}
						onChange={(_, checked: boolean) => setSettings('ignoreIncompatibleLobbyBrowserMods', checked)}
						control={<Checkbox />}
					/>
				</div>
				<ServerURLInput
					t={t}
					initialURL={settings.serverURL}
					onValidURL={URLInputCallback}
					className={classes.dialog}
				/>
				<Divider />
				<Typography variant="h6">{t('settings.beta.title')}</Typography>
				<div>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.mobilehost')}
						checked={settings.mobileHost}
						onChange={(_, checked: boolean) => setSettings('mobileHost', checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.vad_enabled')}
						checked={settings.vadEnabled}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.beta.vad_enabled_warning'),
								() => setSettings('vadEnabled', checked),
								!checked
							);
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.hardware_acceleration')}
						checked={settings.hardware_acceleration}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.beta.hardware_acceleration_warning'),
								() => {
									setSettings('hardware_acceleration', checked);
									bridge.send("relaunch");
								},
								!checked
							);
						}}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.echocancellation')}
						checked={settings.echoCancellation}
						onChange={(_, checked: boolean) => setSettings('echoCancellation', checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.spatial_audio')}
						checked={settings.enableSpatialAudio}
						onChange={(_, checked: boolean) => setSettings('enableSpatialAudio', checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.noiseSuppression')}
						checked={settings.noiseSuppression}
						onChange={(_, checked: boolean) => setSettings('noiseSuppression', checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.beta.oldsampledebug')}
						checked={settings.oldSampleDebug}
						onChange={(_, checked: boolean) => {
							openWarningDialog(
								t('settings.warning'),
								t('settings.beta.oldsampledebug_warning'),
								() => {
									setSettings('oldSampleDebug', checked);
								},
								checked
							);


						}}
						control={<Checkbox />}
					/>
				</div>
				<TextField
					fullWidth
					select
					label={t('settings.language')}
					variant="outlined"
					color="secondary"
					value={settings.language}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => setSettings('language', ev.target.value)}
				>
					{Object.entries(languages).map(([key, value]) => (
						<option key={key} value={key}>
							{value.name}
						</option>
					))}
				</TextField>
				<Divider />
				<Typography variant="h6">{t('settings.streaming.title')}</Typography>
				<div>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.streaming.hidecode')}
						checked={!settings.hideCode}
						onChange={(_, checked: boolean) => setSettings('hideCode', !checked)}
						control={<Checkbox />}
					/>
					<FormControlLabel
						className={classes.formLabel}
						label={t('settings.streaming.obs_overlay')}
						checked={settings.obsOverlay}
						onChange={(_, checked: boolean) => {
							setSettings('obsOverlay', checked);
							if (!settings.obsSecret) {
								setSettings('obsSecret', Math.random().toString(36).substr(2, 9).toUpperCase());
							}
						}}
						control={<Checkbox />}
					/>
					{settings.obsOverlay && (
						<>
							<TextField
								fullWidth
								spellCheck={false}
								label={t('settings.streaming.obs_url')}
								value={`${settings.serverURL.includes('https') ? 'https' : 'http'}://obs.bettercrewlink.app/?compact=${settings.compactOverlay ? '1' : '0'
									}&position=${settings.overlayPosition}&meeting=${settings.meetingOverlay ? '1' : '0'}&secret=${settings.obsSecret
									}&server=${settings.serverURL}`}
								variant="outlined"
								color="primary"
								InputProps={{
									readOnly: true,
								}}
							/>
						</>
					)}
				</div>
				<Divider />
				<Typography variant="h6">{t('settings.troubleshooting.title')}</Typography>
				<div>
					<DisabledTooltip disabled={!canResetSettings} title={t('settings.troubleshooting.warning')}>
						<Button
							disabled={!canResetSettings}
							variant="contained"
							color="secondary"
							onClick={() =>
								openWarningDialog(
									t('settings.warning'),
									t('settings.troubleshooting.restore_warning'),
									() => resetDefaults(),
									true
								)
							}
						>
							{t('settings.troubleshooting.restore')}
						</Button>
					</DisabledTooltip>
				</div>
				<Alert className={classes.alert} severity="info" style={{ display: unsaved ? undefined : 'none' }}>
					{t('buttons.exit')}
				</Alert>
			</div>
		</Box>
	);
};

export default Settings;
