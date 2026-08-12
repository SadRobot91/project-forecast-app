import React from 'react';
import {Series, staticFile} from 'remotion';
import {TitleCard} from './scenes/TitleCard';
import {ScreenScene} from './scenes/ScreenScene';
import {ProblemScene} from './scenes/ProblemScene';
import {SCENES} from './scenes.config';

export const Main: React.FC = () => {
	return (
		<Series>
			{SCENES.map((scene) => (
				<Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
					{scene.type === 'problem' ? (
						<ProblemScene audioSrc={staticFile(`audio/${scene.id}.mp3`)} />
					) : scene.type === 'title' ? (
						<TitleCard
							heading={scene.heading}
							tagline={scene.tagline}
							accent={scene.accent}
							audioSrc={staticFile(`audio/${scene.id}.mp3`)}
						/>
					) : (
						<ScreenScene
							src={staticFile(`screenshots/${scene.image}`)}
							title={scene.title}
							subtitle={scene.subtitle}
							direction={scene.direction}
							audioSrc={staticFile(`audio/${scene.id}.mp3`)}
						/>
					)}
				</Series.Sequence>
			))}
		</Series>
	);
};
