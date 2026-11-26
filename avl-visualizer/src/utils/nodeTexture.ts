import * as THREE from 'three';

export interface NodeVisualPalette {
  border: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
  tag: string | null;
}

export function createMetallicNodeTexture(params: {
  intervalStart: number;
  intervalEnd: number;
  height: number;
  balanceFactor: number;
  palette: NodeVisualPalette;
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Clear
  ctx.clearRect(0, 0, 512, 256);

  // Rounded metallic plate
  const r = 28;
  const x = 14;
  const y = 14;
  const w = 484;
  const h = 228;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, y, 512, y + h);
  grad.addColorStop(0, '#1f283a');
  grad.addColorStop(0.5, '#0f141e');
  grad.addColorStop(1, '#182030');
  ctx.fillStyle = grad;
  ctx.shadowColor = params.palette.glow;
  ctx.shadowBlur = 18;
  ctx.fill();

  // Metallic top sheen
  ctx.shadowBlur = 0;
  ctx.strokeStyle = params.palette.border;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Subtle inner metallic rim
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Optional status tag at top
  if (params.palette.tag) {
    ctx.fillStyle = params.palette.badgeBg;
    ctx.beginPath();
    ctx.roundRect(36, 26, 178, 34, 10);
    ctx.fill();
    ctx.fillStyle = params.palette.badgeText;
    ctx.font = '700 18px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(params.palette.tag, 125, 44);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 17px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('AVL INTERVAL NODE', 38, 44);
  }

  // Interval label [start, end]
  const label = `[${params.intervalStart}, ${params.intervalEnd}]`;
  ctx.fillStyle = '#f8fafc';
  ctx.font = label.length > 13
    ? '700 42px ui-monospace, SFMono-Regular, monospace'
    : '700 50px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 118);

  // Divider line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, 168);
  ctx.lineTo(476, 168);
  ctx.stroke();

  // Height pill
  ctx.fillStyle = '#141b28';
  ctx.beginPath();
  ctx.roundRect(36, 182, 200, 42, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#93c5fd';
  ctx.font = '600 22px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HEIGHT: ${params.height}`, 136, 204);

  // Balance Factor pill
  const bfUnbalanced = Math.abs(params.balanceFactor) > 1;
  ctx.fillStyle = bfUnbalanced ? 'rgba(239, 68, 68, 0.22)' : 'rgba(34, 211, 238, 0.14)';
  ctx.beginPath();
  ctx.roundRect(276, 182, 200, 42, 10);
  ctx.fill();
  ctx.strokeStyle = bfUnbalanced ? '#f87171' : 'rgba(34, 211, 238, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = bfUnbalanced ? '#fca5a5' : '#67e8f9';
  ctx.font = '700 22px ui-monospace, SFMono-Regular, monospace';
  const bfSigned = params.balanceFactor > 0 ? `+${params.balanceFactor}` : `${params.balanceFactor}`;
  ctx.fillText(`BF: ${bfSigned}`, 376, 204);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
