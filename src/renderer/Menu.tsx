import React from 'react';
import Footer from './Footer';
import makeStyles from '@mui/styles/makeStyles';
import Typography from '@mui/material/Typography';
import SupportLink from './SupportLink';
import LaunchButton from './LaunchButton';

const useStyles = makeStyles((theme) => ({
	root: {
		width: '100vw',
		height: '100vh',
		paddingTop: theme.spacing(3),
		boxSizing: 'border-box',
		backgroundColor: '#25232a',
		color: theme.palette.common.white,
	},
	error: {
		paddingTop: theme.spacing(4),
	},
	menu: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'start',
	},
	waiting: {
		fontSize: 20,
		marginTop: 12,
		marginBottom: 12,
	},
	statusDot: {
		width: 40,
		height: 40,
		borderRadius: '50%',
		border: `4px solid ${theme.palette.primary.main}`,
		boxSizing: 'border-box',
	},
	open_message: {
		fontSize: 24,
		marginTop: '15px',
		marginBottom: '5px',
	},
}));

export interface MenuProps {
	t: (key: string) => string;
	error: string;
}

const Menu: React.FC<MenuProps> = function ({ t, error }: MenuProps) {
	const classes = useStyles();

	return (
		<div className={classes.root}>
			<div className={classes.menu}>
				{error ? (
					<div className={classes.error}>
						<Typography align="center" variant="h6" color="error">
							{t('game.error')}
						</Typography>
						<Typography align="center" style={{ whiteSpace: 'pre-wrap' }}>
							{error}
						</Typography>
						<SupportLink />
					</div>
				) : (
					<>
						<span className={classes.waiting}>{t('game.waiting')}</span>
						<span className={classes.statusDot} />
						<span className={classes.open_message}>{t('game.open')}</span>
						<LaunchButton t={t} />
					</>
				)}
				<Footer />
			</div>
		</div>
	);
};

export default Menu;
