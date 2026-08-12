import React from 'react';
import {AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const CELLS = new Array(24).fill(0);

export const ProblemScene: React.FC<{audioSrc?: string}> = ({audioSrc}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();

	const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 25});
	const exit = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const opacity = Math.min(enter, exit);
	const shake = interpolate(frame % 6, [0, 3, 6], [0, 1.5, 0]);

	return (
		<AbsoluteFill style={{backgroundColor: '#0b0d14', justifyContent: 'center', alignItems: 'center'}}>
			<div
				style={{
					opacity,
					display: 'grid',
					gridTemplateColumns: 'repeat(6, 130px)',
					gap: 4,
					transform: `translateX(${shake}px) scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
				}}
			>
				{CELLS.map((_, i) => {
					const delay = (i % 6) * 2 + Math.floor(i / 6) * 2;
					const cellIn = spring({frame: frame - delay, fps, config: {damping: 200}, durationInFrames: 15});
					const isBroken = i === 8 || i === 15 || i === 20;
					return (
						<div
							key={i}
							style={{
								width: 130,
								height: 46,
								border: '1px solid #2a2d3d',
								background: isBroken ? 'rgba(239,68,68,0.15)' : '#12141f',
								opacity: cellIn,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontFamily: 'monospace',
								fontSize: 13,
								color: isBroken ? '#ef4444' : '#4b4f66',
							}}
						>
							{isBroken ? '#REF!' : ''}
						</div>
					);
				})}
			</div>
			<div
				style={{
					position: 'absolute',
					bottom: 120,
					opacity,
					textAlign: 'center',
					fontFamily: 'Inter, sans-serif',
				}}
			>
				<div style={{fontSize: 50, fontWeight: 700, color: '#f4f4f8'}}>
					Ancora un file Excel per budget e risorse?
				</div>
			</div>
			{audioSrc ? <Audio src={audioSrc} /> : null}
		</AbsoluteFill>
	);
};
