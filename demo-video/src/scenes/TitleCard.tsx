import React from 'react';
import {AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const TitleCard: React.FC<{
	heading: string;
	tagline?: string;
	accent?: boolean;
	audioSrc?: string;
}> = ({heading, tagline, accent = true, audioSrc}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();

	const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 25});
	const exitStart = durationInFrames - 15;
	const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const opacity = Math.min(enter, exit);
	const scale = interpolate(enter, [0, 1], [0.9, 1]);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#0b0d14',
				backgroundImage:
					'radial-gradient(circle at 20% 20%, rgba(108,99,255,0.25) 0%, rgba(11,13,20,0) 45%), radial-gradient(circle at 80% 80%, rgba(45,212,230,0.15) 0%, rgba(11,13,20,0) 45%)',
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			<div
				style={{
					opacity,
					transform: `scale(${scale})`,
					textAlign: 'center',
					fontFamily: 'Inter, sans-serif',
				}}
			>
				{accent ? (
					<div
						style={{
							width: 72,
							height: 72,
							borderRadius: 18,
							background: '#6c63ff',
							margin: '0 auto 28px',
						}}
					/>
				) : null}
				<div style={{fontSize: 72, fontWeight: 800, color: '#f4f4f8'}}>{heading}</div>
				{tagline ? (
					<div style={{fontSize: 30, color: '#a8adc0', marginTop: 18}}>{tagline}</div>
				) : null}
			</div>
			{audioSrc ? <Audio src={audioSrc} /> : null}
		</AbsoluteFill>
	);
};
