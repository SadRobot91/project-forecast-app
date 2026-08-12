export const FPS = 30;
const PAD_FRAMES = 18; // 0.6s buffer after each line finishes

const framesFor = (seconds: number) => Math.ceil(seconds * FPS) + PAD_FRAMES;

type Scene =
	| {
			id: string;
			type: 'problem';
			durationInFrames: number;
	  }
	| {
			id: string;
			type: 'title';
			heading: string;
			tagline?: string;
			accent?: boolean;
			durationInFrames: number;
	  }
	| {
			id: string;
			type: 'screen';
			image: string;
			title: string;
			subtitle?: string;
			direction: 'in' | 'out';
			durationInFrames: number;
	  };

// durationInFrames = matching audio/<id>.mp3 length (see public/audio/manifest.json) + padding
export const SCENES: Scene[] = [
	{
		id: '00-problem',
		type: 'problem',
		durationInFrames: framesFor(6),
	},
	{
		id: '01-solution',
		type: 'title',
		heading: 'Project Forecast',
		tagline: 'Budget, risorse e memoria di progetto in un’unica app',
		accent: true,
		durationInFrames: framesFor(5),
	},
	{
		id: '02-dashboard',
		type: 'screen',
		image: '02-dashboard-overview.jpg',
		title: 'Budget, forecast e scostamento',
		subtitle: 'In tempo reale, fase per fase',
		direction: 'in',
		durationInFrames: framesFor(7),
	},
	{
		id: '03-risorse',
		type: 'screen',
		image: '08-registro-risorse.jpg',
		title: 'Sovrallocazioni visibili subito',
		subtitle: 'Registro risorse cross-progetto',
		direction: 'out',
		durationInFrames: framesFor(8),
	},
	{
		id: '04-knowledge-graph',
		type: 'screen',
		image: '03-memoria-progetto.jpg',
		title: 'Ogni decisione lascia traccia',
		subtitle: 'Decisioni, rischi, slippage e retrospettive nel tempo',
		direction: 'in',
		durationInFrames: framesFor(8),
	},
	{
		id: '05-outro',
		type: 'title',
		heading: 'Project Forecast',
		tagline: 'Pronta per il prossimo passo',
		accent: false,
		durationInFrames: framesFor(3),
	},
];

export const TOTAL_DURATION = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);
