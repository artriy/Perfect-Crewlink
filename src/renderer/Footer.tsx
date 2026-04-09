import React from 'react';
import { bridge } from './bridge';
import makeStyles from '@mui/styles/makeStyles';
import { IconButton, Tooltip, Typography } from '@mui/material';
import { getAppVersion, getInitialAppVersion } from '../common/appVersion';

const useStyles = makeStyles(() => ({
	footer: {
		position: 'absolute',
		left: 8,
		bottom: 8,
		display: 'flex',
		alignItems: 'center',
		gap: 6,
		zIndex: 2,
	},
	button: {
		padding: 4,
	},
	version: {
		color: 'rgba(255, 255, 255, 0.6)',
		fontFamily: '"Source Code Pro", monospace',
		fontSize: 12,
		letterSpacing: 0.8,
	},
}));

const RawFooter: React.FC = function () {
	const classes = useStyles();
	const [appVersion, setAppVersion] = React.useState(getInitialAppVersion());

	React.useEffect(() => {
		let isMounted = true;
		void getAppVersion().then((version) => {
			if (isMounted) {
				setAppVersion(version);
			}
		});

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div className={classes.footer}>
			<Tooltip title="Perfect Crewlink on GitHub" arrow>
				<IconButton
					className={classes.button}
					size="small"
					onClick={() => {
						bridge.openExternal('https://github.com/artriy/Perfect-Crewlink');
					}}
				>
					<svg width={24} height={24} viewBox="0 0 24 24" color="White">
						<path
							fill="currentColor"
							d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
						/>
					</svg>
				</IconButton>
			</Tooltip>
			{appVersion ? <Typography className={classes.version}>v{appVersion}</Typography> : null}
		</div>
	);
};

const Footer = React.memo(RawFooter);

export default Footer;
