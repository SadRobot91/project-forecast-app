import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {FPS, TOTAL_DURATION} from './scenes.config';

export const Root: React.FC = () => {
	return (
		<>
			<Composition
				id="Demo"
				component={Main}
				durationInFrames={TOTAL_DURATION}
				fps={FPS}
				width={1920}
				height={1080}
			/>
		</>
	);
};
