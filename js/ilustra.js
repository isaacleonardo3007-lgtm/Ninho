/* =====================================================================
   NINHO — ilustrações inclusivas (SVG gerado no aparelho)
   Bebê e família com tom de pele escolhido pela gestante. Formas simples,
   sem traços que imponham etnia, gênero ou tipo de família.
   Tons em Store.prefs.tons = { bebe: [i, i, i], mae: i, parceria: i } (índices de TONS).
   ===================================================================== */
(function (g) {
  'use strict';
  const TONS = [
    { cor: '#F7DCC8', nome: 'Muito claro' }, { cor: '#EBC0A0', nome: 'Claro' }, { cor: '#D7A07A', nome: 'Médio claro' },
    { cor: '#B57C55', nome: 'Médio' }, { cor: '#8C5A3A', nome: 'Médio escuro' }, { cor: '#5E3A26', nome: 'Escuro' }, { cor: '#3F271B', nome: 'Muito escuro' },
  ];
  const PADRAO = 3;
  const tom = i => (TONS[+i] || TONS[PADRAO]).cor;
  /** escurece (f < 1) ou clareia (f > 1) uma cor #rrggbb */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const cabelo = c => shade(c, 0.42);
  const bochecha = '#E58F8F';
  let uid = 0;

  /** Bebê enrolado na mantinha, dormindo. */
  function bebe(i, { w = 120, manta = 'var(--ilu-manta, #b98aa8)', titulo = 'Ilustração de um bebê dormindo' } = {}) {
    const c = tom(i), id = 'b' + (++uid);
    return `<svg class="ilu" width="${w}" height="${w}" viewBox="0 0 120 120" role="img" aria-label="${titulo}">
      <defs><clipPath id="${id}"><circle cx="60" cy="47" r="25"/></clipPath></defs>
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="#000" opacity=".06"/>
      <path d="M24 82c0-20 16-34 36-34s36 14 36 34c0 17-16 28-36 28S24 99 24 82z" style="fill:${manta}"/>
      <path d="M30 76c10 8 50 8 60 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <circle cx="35" cy="47" r="5" fill="${c}"/><circle cx="85" cy="47" r="5" fill="${c}"/>
      <circle cx="60" cy="47" r="25" fill="${c}"/>
      <g clip-path="url(#${id})"><path d="M35 34c6-12 19-16 31-13 6 2 10 6 12 10-9-4-20-4-28 1-5 3-10 4-15 2z" fill="${cabelo(c)}"/></g>
      <path d="M58 22c2-4 7-4 8 0" fill="none" stroke="${cabelo(c)}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M47 50q4 3.5 8 0M65 50q4 3.5 8 0" fill="none" stroke="#3b2a33" stroke-width="2" stroke-linecap="round"/>
      <circle cx="45" cy="57" r="4" fill="${bochecha}" opacity=".35"/><circle cx="75" cy="57" r="4" fill="${bochecha}" opacity=".35"/>
      <path d="M56 61q4 3 8 0" fill="none" stroke="#3b2a33" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="47" cy="80" r="6" fill="${c}"/><circle cx="73" cy="80" r="6" fill="${c}"/>
    </svg>`;
  }

  /** Um, dois ou três bebês lado a lado (gestação múltipla). */
  function bebes(lista, { w = 120 } = {}) {
    const n = Math.max(1, Math.min(3, lista.length || 1));
    if (n === 1) return bebe(lista[0], { w });
    const s = Math.round(w * (n === 2 ? 0.78 : 0.62));
    return `<span class="ilu-grupo" role="img" aria-label="Ilustração de ${n === 2 ? 'dois bebês' : 'três bebês'} dormindo">${lista.slice(0, n).map((t, k) =>
      `<span style="margin-left:${k ? -s * 0.22 : 0}px">${bebe(t, { w: s, titulo: '' })}</span>`).join('')}</span>`;
  }

  /** Pessoa adulta (busto), com variação de cabelo. */
  function pessoa(x, c, estilo, manga) {
    const h = cabelo(c);
    const cab = {
      longo: `<path d="M${x - 19} ${62}c-3-24 6-38 19-38s22 14 19 38c-4-6-6-14-6-20-8 4-18 4-26 0 0 6-2 14-6 20z" fill="${h}"/>`,
      curto: `<path d="M${x - 16} 44c0-12 7-19 16-19s16 7 16 19c-5-6-11-8-16-8s-11 2-16 8z" fill="${h}"/>`,
      cacheado: `<g fill="${h}">${[-16, -9, -2, 5, 12, 16].map((d, k) => `<circle cx="${x + d}" cy="${30 + (k % 2) * 4}" r="8"/>`).join('')}<circle cx="${x - 17}" cy="42" r="7"/><circle cx="${x + 17}" cy="42" r="7"/></g>`,
      coque: `<circle cx="${x}" cy="20" r="9" fill="${h}"/><path d="M${x - 16} 44c0-12 7-19 16-19s16 7 16 19c-5-7-11-9-16-9s-11 2-16 9z" fill="${h}"/>`,
    }[estilo] || '';
    return `${estilo === 'longo' ? cab : ''}<path d="M${x - 26} 120c0-26 10-40 26-40s26 14 26 40z" style="fill:${manga}"/>
      <rect x="${x - 6}" y="64" width="12" height="16" rx="5" fill="${c}"/>
      <circle cx="${x}" cy="48" r="17" fill="${c}"/>${estilo === 'longo' ? '' : cab}
      <path d="M${x - 7} 49q2.5 2.5 5 0M${x + 2} 49q2.5 2.5 5 0" fill="none" stroke="#3b2a33" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M${x - 4} 56q4 3 8 0" fill="none" stroke="#3b2a33" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  /** Família: gestante/mãe, parceria (opcional) e bebê no colo. */
  function familia(t = {}, { w = 200, parceria = true } = {}) {
    const tb = (t.bebe || [])[0], c = tom(tb), m = tom(t.mae != null ? t.mae : PADRAO), p = tom(t.parceria != null ? t.parceria : 2);
    const W = parceria ? 200 : 130, xm = parceria ? 72 : 65;
    return `<svg class="ilu" width="${w}" height="${Math.round(w * 120 / W)}" viewBox="0 0 ${W} 120" role="img" aria-label="Ilustração de uma família com um bebê no colo">
      ${parceria ? pessoa(136, p, t.estiloParceria || 'curto', 'var(--ilu-roupa2, #8fa58c)') : ''}
      ${pessoa(xm, m, t.estiloMae || 'cacheado', 'var(--ilu-roupa1, #b98aa8)')}
      <ellipse cx="${xm + 4}" cy="99" rx="21" ry="12" fill="#fff" opacity=".9"/>
      <circle cx="${xm + 13}" cy="92" r="10" fill="${c}"/>
      <path d="M${xm + 9} 92q2 2 4 0M${xm + 15} 92q2 2 4 0" fill="none" stroke="#3b2a33" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="${xm + 9}" cy="96" r="2.4" fill="${bochecha}" opacity=".35"/>
    </svg>`;
  }

  /** Símbolo calmo para o modo de perda: lua crescente com folha. Sem bebê. */
  function cuidado({ w = 96 } = {}) {
    return `<svg class="ilu" width="${w}" height="${w}" viewBox="0 0 100 100" role="img" aria-label="Ilustração de uma lua e uma folha">
      <circle cx="50" cy="50" r="44" style="fill:var(--ilu-calma, #ece6ef)"/>
      <path d="M58 22a30 30 0 1 0 18 48 24 24 0 1 1-18-48z" style="fill:var(--ilu-lua, #c9b7cf)"/>
      <path d="M34 74c8-16 22-22 34-22-4 12-16 24-34 22z" fill="#8fa58c"/><path d="M36 72c10-8 18-12 28-16" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none"/>
    </svg>`;
  }

  /** Paleta de tons para escolher (botões acessíveis). onPick: nome da função global, recebe o índice. */
  function seletor(atual, onPick, rotulo) {
    return `<div class="tons" role="radiogroup" aria-label="${rotulo}">${TONS.map((t, i) =>
      `<button type="button" role="radio" aria-checked="${+atual === i}" aria-label="${t.nome}" class="tom ${+atual === i ? 'on' : ''}" style="background:${t.cor}" onclick="${onPick}(${i})"></button>`).join('')}</div>`;
  }

  g.Ilustra = { TONS, PADRAO, tom, shade, bebe, bebes, familia, cuidado, seletor };
})(window);
