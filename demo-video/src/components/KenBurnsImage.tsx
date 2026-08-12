import React from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export const KenBurnsImage: React.FC<{
	src: string;
	direction?: 'in' | 'out';
	fadeEdgesFrames?: number;
}> = ({src, direction = 'in', fadeEdgesFrames = 15}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();

	const scale =
		direction === 'in'
			? interpolate(frame, [0, durationInFrames], [1, 1.08])
			: interpolate(frame, [0, durationInFrames], [1.08, 1]);

	const translateX = interpolate(frame, [0, durationInFrames], [0, -20]);

	const opacity = interpolate(
		frame,
		[0, fadeEdgesFrames, durationInFrames - fadeEdgesFrames, durationInFrames],
		[0, 1, 1, 0],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
	);

	return (
		<AbsoluteFill style={{backgroundColor: '#0b0d14', opacity}}>
			<AbsoluteFill
				style={{
					transform: `scale(${scale}) translateX(${translateX}px)`,
				}}
			>
				<Img
					src={src}
					style={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
						objectPosition: 'top center',
					}}
				/>
			</AbsoluteFill>
			{/* vignette to keep focus centered, matches dark theme */}
			<AbsoluteFill
				style={{
					background:
						'linear-gradient(180deg, rgba(11,13,20,0.55) 0%, rgba(11,13,20,0) 15%, rgba(11,13,20,0) 78%, rgba(11,13,20,0.65) 100%)',
				}}
			/>
		</AbsoluteFill>
	);
};
