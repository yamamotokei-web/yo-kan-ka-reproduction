/* =====================================================================
   0) GSAP + Lenis 初期化（本家スタック）
      - GSAP/ScrollTrigger を登録
      - Lenis を gsap.ticker で駆動し、scroll を ScrollTrigger に同期
      - イントロ中はスクロールを止める（lenis.stop）
   ===================================================================== */
window.__lenis = null;
(() => {
  'use strict';
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (typeof ScrollTrigger !== 'undefined') lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    if (document.documentElement.classList.contains('top-intro-pending')) lenis.stop();
    window.__lenis = lenis;
  }
})();


/* =====================================================================
   1) KV カルーセル（カード回し）※本家も Swiper ではなく自作
   ===================================================================== */
(() => {
  'use strict';
  const stage = document.querySelector('.top-kv__stage');
  const items = [...stage.querySelectorAll('.top-kv__item:not([data-kv-clone])')];
  const n = items.length;
  let current = Math.max(0, Math.min(n - 1, parseInt(stage.dataset.kvInitialIdx, 10) || 0));
  const STEP = 'steps(5, end)';
  let busy = false;
  const pending = [];

  const look = (d) => (d === 0 ? { blur: 0 } : d === 1 ? { blur: 6 } : { blur: 12 });
  const gap = () => {
    const sp = window.innerWidth < 768;
    return { dx: sp ? 250 : 440, dy: sp ? 95 : 130 };
  };
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      const i = pending.indexOf(id);
      if (i !== -1) pending.splice(i, 1);
      fn();
    }, ms);
    pending.push(id);
  };
  const clearPending = () => { pending.forEach(clearTimeout); pending.length = 0; };
  const stripClones = () =>
    stage.querySelectorAll('.top-kv__item[data-kv-clone]').forEach((c) => c.remove());

  const layout = (animate, skip) => {
    const { dx, dy } = gap();
    const half = Math.floor(n / 2);
    items.forEach((el, i) => {
      if (el === skip) return;
      let E = i - current;
      if (E > half) E -= n;
      if (E < -half) E += n;
      el.style.transition = animate
        ? `translate 0.9s ${STEP}, scale 0.9s ${STEP}, filter 0.9s ${STEP}, opacity 0.6s ease`
        : 'none';
      if (Math.abs(E) > 3) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
      const { blur } = look(Math.abs(E));
      el.style.translate = `calc(-50% + ${E * dx}px) calc(-50% + ${E * -dy}px)`;
      el.style.scale = '1';
      el.style.filter = blur ? `blur(${blur}px)` : 'none';
      el.style.opacity = '1';
      el.style.zIndex = String(5 + E * 2);
      el.style.pointerEvents = E === 0 ? 'auto' : 'none';
      if (animate) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'kv-rattle 0.9s step-end';
      }
    });
  };

  const advance = () => {
    if (busy) return;
    busy = true; stripClones(); clearPending();
    const { dx, dy } = gap();
    const half = Math.floor(n / 2);
    let back = null;
    items.forEach((el, i) => {
      let E = i - current;
      if (E > half) E -= n;
      if (E < -half) E += n;
      if (E === -half) back = el;
    });
    current = (current + 1) % n;
    layout(true, back);
    if (!back) { busy = false; return; }

    const h = half + 1;
    const clone = back.cloneNode(true);
    clone.setAttribute('data-kv-clone', '1');
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'none';
    clone.style.zIndex = '1';
    stage.appendChild(clone);
    const backBlur = look(half).blur;
    const frontBlur = look(h).blur;

    back.style.transition = 'none';
    back.style.translate = `calc(-50% + ${-half * dx}px) calc(-50% + ${half * dy}px)`;
    back.style.filter = backBlur ? `blur(${backBlur}px)` : 'none';
    back.style.zIndex = '5';
    back.style.opacity = '1';
    void back.offsetWidth;
    clone.style.translate = `calc(-50% + ${h * dx}px) calc(-50% + ${-h * dy}px)`;
    clone.style.filter = frontBlur ? `blur(${frontBlur}px)` : 'none';
    void clone.offsetWidth;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      back.style.transition = `translate 0.9s ${STEP}, filter 0.9s ${STEP}`;
      back.style.translate = `calc(-50% + ${-h * dx}px) calc(-50% + ${h * dy}px)`;
      back.style.animation = 'none';
      void back.offsetWidth;
      back.style.animation = 'kv-rattle 0.9s step-end';
      clone.style.transition = `translate 0.9s ${STEP}, filter 0.9s ${STEP}`;
      clone.style.translate = `calc(-50% + ${half * dx}px) calc(-50% + ${-half * dy}px)`;
      clone.style.animation = 'kv-rattle 0.9s step-end';
    }));

    later(() => { back.style.transition = 'opacity 0.3s ease'; back.style.opacity = '0'; }, 900);
    later(() => {
      clone.remove();
      back.style.opacity = '1';
      busy = false;
      layout(false);
      window.dispatchEvent(new CustomEvent('yokankaKvSettled', { detail: { index: current } }));
    }, 1300);
  };

  window.addEventListener('yokankaKvAdvance', advance);
  layout(false);

  const introPending = document.documentElement.classList.contains('top-intro-pending');
  const settle = () =>
    window.dispatchEvent(new CustomEvent('yokankaKvSettled', { detail: { index: current } }));

  if (introPending) {
    // イントロ中は全カードを隠す（中央のみ intro 側がフェードインさせる）
    items.forEach((el) => { el.style.opacity = '0'; });
    // イントロのシーケンス開始イベントで KV を展開
    window.addEventListener('yokankaKvSequenceStart', function onceStart() {
      window.removeEventListener('yokankaKvSequenceStart', onceStart);
      layout(false);                                   // 位置確定（中央は既に表示）
      items.forEach((el, i) => { if (i !== current) { el.style.transition = 'none'; el.style.opacity = '0'; } });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        items.forEach((el, i) => { if (i !== current) { el.style.transition = 'opacity 0.6s ease'; el.style.opacity = '1'; } });
      }));
      setTimeout(settle, 80);                          // 文言・進行バー開始
    });
  } else {
    setTimeout(settle, 400);                           // イントロなし（再訪等）
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!busy) layout(false); }, 200);
  });
})();


/* =====================================================================
   2) 下部 info ボックスのアニメーション（本家 main.js の挙動を再現）
   ===================================================================== */
(() => {
  'use strict';

  // --- タイミング定数（本家と同値） ---
  const KV_TYPE_CHAR_MS           = 92;   // 枠内を1文字ずつタイプする間隔
  const KV_TYPE_BOX_GAP_MS        = 420;  // 「と」跳ね終了〜2つ目の枠タイプ開始まで
  const KV_SUFFIX_BOUNCE_DELAY_MS = 280;  // 「の」跳ね終了〜「ヨウカンカ」跳ね開始まで
  const KV_SUFFIX_BOUNCE_GAP_MS   = 118;  // ヨウカンカの各文字の跳ね開始間隔（ダラララ感）
  const KV_SEASON_MS              = 4000; // 進行バーが満タンになる時間

  const stage = document.querySelector('.top-kv__stage');
  const items = [...stage.querySelectorAll('.top-kv__item:not([data-kv-clone])')];
  const info  = document.querySelector('.top-kv__info');
  const slideCount = items.length;

  const seasonWrap    = info.querySelector('.top-kv__info-season');
  const dialFromTrack = seasonWrap.querySelector('.top-kv__info-season-dial--from .top-kv__info-season-dial-track');
  const dialToTrack   = seasonWrap.querySelector('.top-kv__info-season-dial--to .top-kv__info-season-dial-track');
  const seasonFill    = seasonWrap.querySelector('.top-kv__info-season-fill');
  const seasonTrack   = seasonWrap.querySelector('.top-kv__info-season-track');

  const boxA     = info.querySelector('.top-kv__info-box-text[data-key="a"]');
  const boxB     = info.querySelector('.top-kv__info-box-text[data-key="b"]');
  const suffixEl = info.querySelector('.top-kv__info-suffix');
  const rows = info.querySelectorAll('.top-kv__info-row');
  const connectorTo = rows[0].querySelector('.top-kv__info-connector');
  const connectorNo = rows[1].querySelector('.top-kv__info-connector');

  let typingTimer = null, boxGapTimer = null, suffixBounceTimer = null;
  let dialPrevFrom = -1, dialPrevTo = -1, lastSettledKvIdx = 0;

  /* ---------- 数字ダイヤル ---------- */
  const buildDialTrack = (track, count) => {
    track.innerHTML = '';
    for (let d = 1; d <= count; d += 1) {
      const s = document.createElement('span');
      s.className = 'top-kv__info-season-dial-digit';
      s.textContent = String(d);
      track.appendChild(s);
    }
    const dup = document.createElement('span');
    dup.className = 'top-kv__info-season-dial-digit';
    dup.textContent = '1';
    track.appendChild(dup);
    track._stepPx = null;
  };
  const stepPx = (track) => {
    if (track._stepPx) return track._stepPx;
    const d0 = track.querySelector('.top-kv__info-season-dial-digit');
    track._stepPx = d0 ? d0.getBoundingClientRect().height : 18;
    return track._stepPx;
  };
  const clearSnap = (track) => {
    if (track._snap) { track.removeEventListener('transitionend', track._snap); track._snap = null; }
  };
  const moveSlot = (track, slot, instant) => {
    clearSnap(track);
    const px = stepPx(track);
    if (instant) track.classList.add('is-instant');
    track.style.transform = `translate3d(0,${-slot * px}px,0)`;
    if (instant) { void track.offsetWidth; track.classList.remove('is-instant'); }
  };
  const animateDial = (track, prev, next, count) => {
    if (!count) return;
    if (prev < 0) { moveSlot(track, next - 1, true); return; }
    if (next === prev) return;
    if (prev === count && next === 1) {              // n→1 はダミーの末尾1へ送ってから瞬間で先頭へ
      moveSlot(track, count, false);
      const snap = (ev) => {
        if (ev.target !== track) return;
        if (!ev.propertyName.includes('transform')) return;
        clearSnap(track);
        moveSlot(track, 0, true);
      };
      track._snap = snap;
      track.addEventListener('transitionend', snap);
      return;
    }
    if (next === prev + 1) { moveSlot(track, next - 1, false); return; }
    moveSlot(track, next - 1, true);
  };

  /* ---------- season（ダイヤル更新 + バー走らせ） ---------- */
  const syncSeason = (idx) => {
    const i = ((idx % slideCount) + slideCount) % slideCount;
    const fromN = i + 1;
    const toN = ((i + 1) % slideCount) + 1;
    animateDial(dialFromTrack, dialPrevFrom, fromN, slideCount);
    animateDial(dialToTrack, dialPrevTo, toN, slideCount);
    dialPrevFrom = fromN; dialPrevTo = toN;
    seasonTrack.style.setProperty('--kv-season-ms', `${KV_SEASON_MS}ms`);
    seasonFill.classList.remove('is-running');
    void seasonFill.offsetWidth;
    seasonFill.classList.add('is-running');
  };

  /* ---------- suffix（ヨウカンカ）を1文字ずつ <span> 化 ---------- */
  const ensureSuffixChars = (text) => {
    const chars = [...(text || 'ヨウカンカ')];
    const ex = suffixEl.querySelectorAll('.top-kv__info-suffix-char');
    if (ex.length === chars.length) {
      const same = [...ex].every((el, i) => el.textContent === chars[i]);
      if (same) return [...ex];
    }
    suffixEl.textContent = '';
    return chars.map((ch) => {
      const s = document.createElement('span');
      s.className = 'top-kv__info-suffix-char';
      s.textContent = ch;
      suffixEl.appendChild(s);
      return s;
    });
  };
  ensureSuffixChars('ヨウカンカ');

  const resetBounce = () => {
    if (suffixBounceTimer) { clearTimeout(suffixBounceTimer); suffixBounceTimer = null; }
    connectorTo.classList.remove('is-bounce');
    connectorNo.classList.remove('is-bounce');
    suffixEl.querySelectorAll('.top-kv__info-suffix-char').forEach((c) => c.classList.remove('is-bounce-fast'));
  };

  /* ---------- 跳ね（接続詞） ---------- */
  const bounceEl = (el, done) => {
    if (!el) { done?.(); return; }
    el.classList.remove('is-bounce');
    void el.offsetWidth;
    el.classList.add('is-bounce');
    const end = (ev) => {
      if (ev.target !== el || !(ev.animationName || '').includes('top-kv-info-bounce')) return;
      el.removeEventListener('animationend', end);
      el.classList.remove('is-bounce');
      done?.();
    };
    el.addEventListener('animationend', end);
  };

  /* ---------- 跳ね（ヨウカンカを順番にパラパラ） ---------- */
  const bounceSuffix = (text) => {
    const spans = ensureSuffixChars(text || 'ヨウカンカ');
    spans.forEach((c) => c.classList.remove('is-bounce-fast'));
    let idx = 0;
    const kick = () => {
      if (idx >= spans.length) return;
      const s = spans[idx];
      s.classList.remove('is-bounce-fast');
      void s.offsetWidth;
      s.classList.add('is-bounce-fast');
      idx += 1;
      suffixBounceTimer = setTimeout(kick, KV_SUFFIX_BOUNCE_GAP_MS);
    };
    kick();
  };

  /* ---------- 長い名前は枠内に収まるよう文字サイズを自動縮小 ---------- */
  const fitText = (el, text) => {
    el.style.fontSize = '';            // 一旦リセットして基準サイズに戻す
    el.style.transform = '';
    el.textContent = text || '';
    // scrollWidth(全文の幅) が clientWidth(枠の表示幅) を超えていたら縮小
    if (el.scrollWidth > el.clientWidth && el.clientWidth > 0) {
      const ratio = (el.clientWidth / el.scrollWidth) * 0.98;
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(10, base * ratio)}px`;
    }
    el.textContent = '';               // タイプ表示のため空に戻す
  };

  /* ---------- 枠内を1文字ずつタイプ ---------- */
  const typeText = (el, text, done) => {
    const v = text || '';
    el.textContent = '';
    let i = 0;
    const step = () => {
      if (i <= v.length) {
        el.textContent = v.slice(0, i);
        i += 1;
        typingTimer = setTimeout(step, KV_TYPE_CHAR_MS);
      } else {
        done?.();
      }
    };
    step();
  };

  /* ---------- 文言シーケンス本体 ---------- */
  const update = (item) => {
    const ds = item.dataset;
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
    if (boxGapTimer) { clearTimeout(boxGapTimer); boxGapTimer = null; }
    resetBounce();
    boxB.textContent = '';

    setTimeout(() => {
      boxB.textContent = '';
      info.classList.remove('is-fading');
      // 長い名前（例：ホワイトチョコレート）が見切れないよう先にサイズ調整
      fitText(boxA, ds.nameA || '');
      fitText(boxB, ds.nameB || '');
      // ① 1つ目の枠（苺）をタイプ
      typeText(boxA, ds.nameA || '', () => {
        // ② 「と」が跳ねる
        bounceEl(connectorTo, () => {
          // ③ 少し間をおいて2つ目の枠（タルト）をタイプ
          boxGapTimer = setTimeout(() => {
            boxGapTimer = null;
            typeText(boxB, ds.nameB || '', () => {
              // ④ 「の」が跳ねる
              bounceEl(connectorNo, () => {
                // ⑤ 「ヨウカンカ」が一文字ずつパラパラ跳ねる
                suffixBounceTimer = setTimeout(() => {
                  suffixBounceTimer = null;
                  bounceSuffix(ds.nameSuffix || 'ヨウカンカ');
                }, KV_SUFFIX_BOUNCE_DELAY_MS);
              });
            });
          }, KV_TYPE_BOX_GAP_MS);
        });
      });
    }, 200);
  };

  /* ---------- ダイヤル初期化 ---------- */
  buildDialTrack(dialFromTrack, slideCount);
  buildDialTrack(dialToTrack, slideCount);
  {
    const f0 = 1;
    const t0 = (1 % slideCount) + 1;
    moveSlot(dialFromTrack, f0 - 1, true);
    moveSlot(dialToTrack, t0 - 1, true);
    dialPrevFrom = f0; dialPrevTo = t0;
  }

  /* ---------- KV が静止したら：文言を出し、バーを走らせる ---------- */
  window.addEventListener('yokankaKvSettled', (ev) => {
    const idx = (typeof ev.detail?.index === 'number') ? ev.detail.index : 0;
    lastSettledKvIdx = idx;
    update(items[idx]);
    syncSeason(idx);
  });

  /* ---------- バー満タン → テキスト消し、ダイヤル送り、カードを進める ---------- */
  seasonFill.addEventListener('animationend', (ev) => {
    if (ev.target !== seasonFill || !seasonFill.classList.contains('is-running')) return;
    if (!(ev.animationName || '').toLowerCase().includes('top-kv-season-progress')) return;
    seasonFill.classList.remove('is-running');
    info.classList.add('is-fading');                 // 枠内テキストをフェードアウト
    const nextIdx = (lastSettledKvIdx + 1) % slideCount;
    const fromN = nextIdx + 1;
    const toN = ((nextIdx + 1) % slideCount) + 1;
    animateDial(dialFromTrack, dialPrevFrom, fromN, slideCount);
    animateDial(dialToTrack, dialPrevTo, toN, slideCount);
    dialPrevFrom = fromN; dialPrevTo = toN;
    window.dispatchEvent(new CustomEvent('yokankaKvAdvance')); // → カルーセルが次へ
  });
})();


/* =====================================================================
   3) 見出しの文字マスク出現（スクロールで下から押し上げ）
   ===================================================================== */
(() => {
  'use strict';
  const heading = document.querySelector('.top-features__heading');
  if (!heading) return;

  // テキストを1文字ずつ <span.char-mask><span.char-inner> に分解
  const nodes = [...heading.childNodes];
  heading.innerHTML = '';
  let i = 0;
  nodes.forEach((node) => {
    if (node.nodeName === 'BR') { heading.appendChild(document.createElement('br')); return; }
    [...node.textContent].forEach((ch) => {
      if (ch === ' ') { heading.appendChild(document.createTextNode(' ')); return; }
      const mask = document.createElement('span'); mask.className = 'char-mask';
      const inner = document.createElement('span'); inner.className = 'char-inner';
      inner.textContent = ch;
      inner.style.transitionDelay = `${i * 50}ms`;
      mask.appendChild(inner);
      heading.appendChild(mask);
      i += 1;
    });
  });

  // スクロールで画面に入ったら is-revealed（CSS の char-inner トランジションが発火）
  const reveal = () => heading.classList.add('is-revealed');
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({ trigger: heading, start: 'top 80%', once: true, onEnter: reveal });
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { reveal(); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(heading);
  }
})();


/* =====================================================================
   4) PC ホバー：画像がマウスに追従して浮き出る（cursor-yokan）
      本家 main.js の挙動を再現。項目を移ると画像がワイプで切替わる。
   ===================================================================== */
(() => {
  'use strict';
  const CURSOR_W = 172, CURSOR_H = 228, LERP = 0.14, WIPE_MS = 550;

  const init = () => {
    if (window.matchMedia('(max-width: 767px)').matches) return;  // SP は無効
    const section = document.querySelector('.top-features');
    const items = document.querySelectorAll('.js-top-features-item');
    if (!section || !items.length) return;

    // カーソル用カードを生成（viewport + base/cover の2ペイン）
    const cursor = document.createElement('div');
    cursor.className = 'cursor-yokan';
    const viewport = document.createElement('div'); viewport.className = 'cursor-yokan__viewport';
    const paneBase = document.createElement('div'); paneBase.className = 'cursor-yokan__pane cursor-yokan__pane--base';
    const paneCover = document.createElement('div'); paneCover.className = 'cursor-yokan__pane cursor-yokan__pane--cover';
    const imgBase = document.createElement('img'); imgBase.alt = ''; imgBase.setAttribute('aria-hidden', 'true');
    const imgCover = document.createElement('img'); imgCover.alt = ''; imgCover.setAttribute('aria-hidden', 'true');
    paneBase.appendChild(imgBase);
    paneCover.appendChild(imgCover);
    viewport.append(paneBase, paneCover);
    cursor.appendChild(viewport);
    section.appendChild(cursor);

    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, rafId = null;
    let activeItem = null, currentSrc = '', isTransitioning = false, transitionTimer = null;

    const applyPos = () => {
      cursor.style.transform = `translate3d(${currentX.toFixed(2)}px,${currentY.toFixed(2)}px,0)`;
    };
    const tick = () => {
      rafId = null;
      if (!cursor.classList.contains('is-visible')) return;
      currentX += (targetX - currentX) * LERP;   // ← lerp で滑らかに追従
      currentY += (targetY - currentY) * LERP;
      applyPos();
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        rafId = requestAnimationFrame(tick);
      }
    };
    const scheduleTick = () => { if (rafId == null) rafId = requestAnimationFrame(tick); };
    const setTargetFromEvent = (e) => {
      targetX = e.clientX - CURSOR_W / 2;        // カーソルがカード中央に来るよう補正
      targetY = e.clientY - CURSOR_H / 2;
      scheduleTick();
    };

    const resetCover = (instant) => {
      paneCover.classList.remove('is-wiping');
      if (instant) {
        paneCover.style.transition = 'none';
        paneCover.style.transform = 'translate3d(-100%,0,0)';
        void paneCover.offsetHeight;
        paneCover.style.transition = '';
        paneCover.style.transform = '';
      }
      if (transitionTimer) { clearTimeout(transitionTimer); transitionTimer = null; }
      isTransitioning = false;
    };
    const setImageImmediate = (src) => { resetCover(true); currentSrc = src; imgBase.src = src; imgCover.src = src; };
    const finishTransition = (src) => {
      if (!isTransitioning && currentSrc === src) return;
      resetCover(true); currentSrc = src; imgBase.src = src; imgCover.src = src;
    };
    // 別項目に移ったとき：cover に新画像を入れ、左から右へワイプして見せる
    const beginWipe = (src) => {
      resetCover(true);
      isTransitioning = true;
      imgCover.src = src;
      requestAnimationFrame(() => requestAnimationFrame(() => paneCover.classList.add('is-wiping')));
      let done = false;
      const complete = () => { if (done) return; done = true; finishTransition(src); };
      paneCover.addEventListener('transitionend', (e) => {
        if (e.target !== paneCover || e.propertyName !== 'transform') return;
        complete();
      }, { once: true });
      transitionTimer = setTimeout(complete, WIPE_MS + 100);
    };
    const transitionToImage = (src) => {
      if (!src || src === currentSrc) return;
      const pre = new Image();
      let started = false;
      const run = () => { if (started) return; started = true; beginWipe(src); };
      pre.onload = run;
      pre.onerror = run;
      pre.src = src;
      if (pre.complete) run();
    };

    const showForItem = (item, e) => {
      const src = item.getAttribute('data-hover-src');
      if (!src) return;
      const wasVisible = cursor.classList.contains('is-visible');
      activeItem = item;
      setTargetFromEvent(e);
      if (!wasVisible || !currentSrc) setImageImmediate(src);
      else if (src !== currentSrc) transitionToImage(src);
      cursor.classList.add('is-visible');
      scheduleTick();
    };
    const hideCursor = () => {
      activeItem = null;
      resetCover();
      cursor.classList.remove('is-visible');
      currentSrc = '';
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    };

    items.forEach((item) => {
      item.addEventListener('mouseenter', (e) => showForItem(item, e));
      item.addEventListener('mousemove', (e) => { if (activeItem === item) setTargetFromEvent(e); });
      item.addEventListener('mouseleave', () => { if (activeItem === item) hideCursor(); });
    });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(init, 100);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
})();


/* =====================================================================
   5) 初回ローディング（イントロ）— 本家 yokanka-top-intro.js を再現
      見出しを1文字ずつぼかしフェード → 中央の羊羹がぼけて出現しピント合致
      → ロゴ「YO KA N KA」フェードイン → KV 展開＆カルーセル開始
   ===================================================================== */
(() => {
  'use strict';
  const html = document.documentElement;
  if (!html.classList.contains('top-intro-pending')) return;

  // タイミング定数（本家と同値・秒）
  const HEAD_STAGGER = 0.1, HEAD_CHAR_DUR = 0.5, HEAD_BLUR_FROM = 12;
  const KV_CENTER_FADE = 0.55, KV_CENTER_BLUR_FROM = 10, KV_CENTER_BLUR_CLEAR = 0.45;
  const WORDMARK_DELAY = 0.45, WORDMARK_FADE = 1.45, WORDMARK_PAUSE = 0.5;

  const release = () => {
    html.classList.remove('top-intro-pending');
    window.__lenis?.start();                              // スクロール再開
  };
  const startSequence = () => {
    try { window.dispatchEvent(new CustomEvent('yokankaKvSequenceStart')); } catch {}
  };

  // モーション抑制設定なら即解放
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    release();
    const c0 = document.querySelector('.top-kv__item[data-idx="0"]');
    if (c0) { c0.style.opacity = '1'; c0.style.filter = 'none'; }
    startSequence();
    return;
  }

  const heading = document.querySelector('.top-hero__heading');
  const wordmark = document.querySelector('.top-hero__wordmark');
  const sub = document.querySelector('.top-hero__sub');
  const center = document.querySelector('.top-kv__item[data-idx="0"]');

  // 見出しグループの data-* を各文字へ展開（pause / blur 制御 / 文字ごとの速度）
  heading.querySelectorAll('.top-hero__heading-group').forEach((g) => {
    const chs = g.querySelectorAll('.top-hero__heading-char');
    if (!chs.length) return;
    const pa = g.getAttribute('data-intro-pause-after');
    if (pa) chs[chs.length - 1].setAttribute('data-after-pause-ms', pa);
    if (g.getAttribute('data-intro-kv-show-blur') === '1') chs[0].setAttribute('data-kv-show-blur', '1');
    if (g.getAttribute('data-intro-kv-clear-blur') === '1') {
      chs[0].setAttribute('data-kv-clear-blur', '1');
      const cd = g.getAttribute('data-intro-kv-blur-clear-duration-ms');
      if (cd) chs[0].setAttribute('data-kv-blur-clear-ms', cd);
    }
    const cdm = g.getAttribute('data-intro-char-duration-ms');
    if (cdm) chs.forEach((c) => c.setAttribute('data-char-dur-ms', cdm));
    const sm = g.getAttribute('data-intro-stagger-ms');
    if (sm) chs.forEach((c) => c.setAttribute('data-stagger-ms', sm));
  });

  // タイムライン計算（本家と同じ積み上げ方式）
  const chars = heading.querySelectorAll('.top-hero__heading-char');
  const last = chars[chars.length - 1];
  let t = 0, kvAppearAt = null, kvClearAt = null, kvClearDur = KV_CENTER_BLUR_CLEAR, headingRevealAt = 0;
  const sched = [];
  chars.forEach((ch) => {
    let dur = HEAD_CHAR_DUR;
    const a = ch.getAttribute('data-char-dur-ms');
    if (a) dur = parseInt(a, 10) / 1000;
    let stg = HEAD_STAGGER;
    const sa = ch.getAttribute('data-stagger-ms');
    if (sa) stg = parseInt(sa, 10) / 1000;
    if (ch.getAttribute('data-kv-show-blur')) kvAppearAt = t;
    if (ch.getAttribute('data-kv-clear-blur')) {
      kvClearAt = t;
      const c = ch.getAttribute('data-kv-blur-clear-ms');
      if (c) kvClearDur = parseInt(c, 10) / 1000;
    }
    sched.push({ el: ch, at: t, dur, mark: ch.classList.contains('top-hero__heading-char--mark') });
    if (ch === last) headingRevealAt = t + dur;
    const pm = ch.getAttribute('data-after-pause-ms');
    if (pm) {
      const sec = parseInt(pm, 10) / 1000;
      if (kvAppearAt == null) kvAppearAt = t + dur + sec;
      t += dur + sec;
    } else {
      t += stg;
    }
  });
  if (kvAppearAt == null) kvAppearAt = 0;
  const wordmarkStart = headingRevealAt + WORDMARK_DELAY;
  const kvExpandAt = wordmark ? wordmarkStart + WORDMARK_FADE + WORDMARK_PAUSE : headingRevealAt + WORDMARK_PAUSE;
  if (kvClearAt == null) kvClearAt = kvExpandAt;

  // ===== GSAP タイムラインでイントロを構築（本家 yokanka-top-intro.js と同じ構成）=====
  if (typeof gsap !== 'undefined') {
    // CSS のトランジションは使わず GSAP に任せる（二重アニメ防止）
    gsap.set(chars, { transition: 'none' });
    if (wordmark) gsap.set(wordmark, { transition: 'none' });
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => { if (sub) gsap.set(sub, { opacity: 0.55 }); },
    });

    // ① 見出しを1文字ずつ（位置=絶対秒）
    sched.forEach((s) => {
      if (s.mark) {
        tl.fromTo(s.el, { opacity: 0 }, { opacity: 1, duration: s.dur }, s.at);
      } else {
        tl.fromTo(s.el,
          { opacity: 0, filter: `blur(${HEAD_BLUR_FROM}px)` },
          { opacity: 1, filter: 'blur(0px)', duration: s.dur }, s.at);
      }
    });

    // ② 中央の羊羹：ぼけて出現 → ピント合致
    if (center) {
      gsap.set(center, { filter: `blur(${KV_CENTER_BLUR_FROM}px)` });
      tl.to(center, { autoAlpha: 1, duration: KV_CENTER_FADE }, kvAppearAt);
      tl.to(center, { filter: 'blur(0px)', duration: kvClearDur }, kvClearAt);
    }

    // ③ ロゴをフェードイン
    if (wordmark) tl.fromTo(wordmark, { autoAlpha: 0 }, { autoAlpha: 1, duration: WORDMARK_FADE }, wordmarkStart);

    // ④ KV 展開・カルーセル開始
    tl.call(() => { release(); startSequence(); }, null, kvExpandAt);

    // 安全装置
    setTimeout(() => {
      if (html.classList.contains('top-intro-pending')) { release(); startSequence(); }
    }, (kvExpandAt + 3) * 1000);

  } else {
    // GSAP 未読込のフォールバック（CSS トランジション + setTimeout）
    const at = (sec, fn) => setTimeout(fn, Math.max(0, sec * 1000));
    sched.forEach((s) => {
      at(s.at, () => {
        s.el.style.transitionDuration = `${s.dur}s, ${s.dur}s`;
        s.el.style.opacity = '1';
        if (!s.mark) s.el.style.filter = 'blur(0px)';
      });
    });
    if (center) {
      center.style.filter = `blur(${KV_CENTER_BLUR_FROM}px)`;
      center.style.transition = `opacity ${KV_CENTER_FADE}s ease, filter ${kvClearDur}s ease`;
      at(kvAppearAt, () => { center.style.opacity = '1'; });
      at(kvClearAt, () => { center.style.filter = 'blur(0px)'; });
    }
    if (wordmark) at(wordmarkStart, () => { wordmark.style.opacity = '1'; });
    at(kvExpandAt, () => { release(); if (sub) sub.style.opacity = '0.55'; startSequence(); });
    at(kvExpandAt + 3, () => { if (html.classList.contains('top-intro-pending')) { release(); startSequence(); } });
  }
})();
