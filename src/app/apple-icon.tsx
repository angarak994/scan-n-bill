import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a', // Primary dark blue-gray background
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="70%" height="70%">
          <circle cx="240" cy="240" r="140" fill="none" stroke="#ffffff" strokeWidth="64" />
          <circle cx="240" cy="240" r="48" fill="#10b981" />
          <line x1="320" y1="320" x2="430" y2="430" stroke="#10b981" strokeWidth="64" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
