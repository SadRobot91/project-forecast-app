import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const Caption: React.FC<{
	title: string;
	subtitle?: string;
	align?: 'top' | 'bottom';
}> = ({title, subtitle, align = 'bottom'}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();

	const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 20});
	const exitStart = durationInFrames - 15;
	const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const translateY = interpolate(enter, [0, 1], [20, 0]);
	const opacity = Math.min(enter, exit);

	return (
		<div
			style={{
				position: 'absolute',
				left: 80,
				[align === 'bottom' ? 'bottom' : 'top']: align === 'bottom' ? 70 : 70,
				opacity,
				transform: `translateY(${translateY}px)`,
				maxWidth: 1100,
			}}
		>
			<div
				style={{
					fontFamily: 'Inter, sans-serif',
					fontSize: 54,
					fontWeight: 700,
					color: '#f4f4f8',
					textShadow: '0 4px 24px rgba(0,0,0,0.6)',
				}}
			>
				{title}
			</div>
			{subtitle ? (
				<div
					style={{
						fontFamily: 'Inter, sans-serif',
						fontSize: 28,
						fontWeight: 400,
						color: '#a8adc0',
						marginTop: 10,
						textShadow: '0 4px 20px rgba(0,0,0,0.6)',
					}}
				>
					{subtitle}
				</div>
			) : null}
		</div>
	);
};
