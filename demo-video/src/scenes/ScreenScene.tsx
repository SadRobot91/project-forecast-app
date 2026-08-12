import React from 'react';
import {AbsoluteFill, Audio} from 'remotion';
import {KenBurnsImage} from '../components/KenBurnsImage';
import {Caption} from '../components/Caption';

export const ScreenScene: React.FC<{
	src: string;
	title: string;
	subtitle?: string;
	direction?: 'in' | 'out';
	audioSrc?: string;
}> = ({src, title, subtitle, direction, audioSrc}) => {
	return (
		<AbsoluteFill>
			<KenBurnsImage src={src} direction={direction} />
			<Caption title={title} subtitle={subtitle} />
			{audioSrc ? <Audio src={audioSrc} /> : null}
		</AbsoluteFill>
	);
};
