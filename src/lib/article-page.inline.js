function bindReadingProgress() {
  const root = document.documentElement;
  const progressBar = document.querySelector('.dr-reading-progress__bar');

  if (!progressBar) {
    return;
  }

  let frameId = 0;
  const update = () => {
    frameId = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    progressBar.style.setProperty('--dr-read-progress', progress.toFixed(4));
  };

  const requestUpdate = () => {
    if (frameId !== 0) {
      return;
    }

    frameId = window.requestAnimationFrame(update);
  };

  const enableFallback = () => {
    if (root.classList.contains('dr-progress-fallback')) {
      requestUpdate();
      return;
    }

    root.classList.remove('dr-progress-timeline');
    root.classList.add('dr-progress-fallback');
    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
  };

  if (!CSS.supports('animation-timeline: scroll()')) {
    enableFallback();
    return;
  }

  root.classList.add('dr-progress-timeline');

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (window.scrollY !== 0) {
        return;
      }

      const computedTransform = window.getComputedStyle(progressBar).transform;
      const scaleX =
        computedTransform === 'none'
          ? 1
          : Number.parseFloat(computedTransform.match(/^matrix\(([^,]+)/)?.[1] ?? '1');

      if (!Number.isFinite(scaleX) || scaleX > 0.05) {
        enableFallback();
      }
    });
  });
}

function bindZoomableImages() {
  const overlay = document.querySelector('.dr-media-overlay');
  const overlayImage = overlay?.querySelector('.dr-media-overlay__image');

  if (!overlay || !overlayImage) {
    return;
  }

  if (overlay.parentElement !== document.body) {
    document.body.append(overlay);
  }

  let lastFocused = null;

  const closeOverlay = () => {
    overlay.hidden = true;
    overlayImage.removeAttribute('src');
    overlayImage.removeAttribute('alt');
    document.body.classList.remove('dr-media-overlay-open');
    lastFocused?.focus();
    lastFocused = null;
  };

  const openOverlay = (target) => {
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayImage.src = target.currentSrc || target.src;
    overlayImage.alt = target.alt;
    overlay.hidden = false;
    document.body.classList.add('dr-media-overlay-open');
    overlay.focus();
  };

  const zoomableImages = document.querySelectorAll('.dr-doc-content img[data-dr-zoomable="true"]');

  for (const image of zoomableImages) {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');

    image.addEventListener('click', () => openOverlay(image));
    image.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      openOverlay(image);
    });
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) {
      closeOverlay();
    }
  });
}

function bindArticleVideos() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = document.querySelectorAll('.dr-doc-content video[data-dr-video="true"]');

  if (videos.length === 0) {
    return;
  }

  const applyReducedMotionState = () => {
    for (const video of videos) {
      if (!reduceMotion.matches) {
        continue;
      }

      video.autoplay = false;
      video.pause();
    }
  };

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target;

          if (!entry.isIntersecting) {
            video.pause();
            continue;
          }

          if (!reduceMotion.matches && video.dataset.drAutoplay === 'true') {
            void video.play().catch(() => {});
          }
        }
      }, {
        rootMargin: '96px 0px'
      })
    : null;

  for (const video of videos) {
    video.dataset.drAutoplay = String(video.autoplay);

    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.style.setProperty('--dr-video-ratio', `${video.videoWidth} / ${video.videoHeight}`);
      }
    }, { once: true });

    observer?.observe(video);
  }

  applyReducedMotionState();
  reduceMotion.addEventListener('change', applyReducedMotionState);
}

function bindTocEnhancements() {
  const toc = document.querySelector('.dr-toc--desktop starlight-toc');
  if (!toc) return;

  const links = [...toc.querySelectorAll('a')];
  if (links.length <= 1) return;

  let frameId = 0;
  let atBottom = false;

  const forceLastActive = () => {
    const last = links[links.length - 1];
    const current = toc.querySelector('a[aria-current="true"]');
    if (current === last) return;
    // 通过 StarlightTOC 的 current setter 设置高亮，确保 _current 内部状态同步
    // 避免离开底部后 setter 无法清除最后一个标题的 aria-current
    toc.current = last;
    // 降级：setter 不存在时直接操作 DOM
    if (!last.hasAttribute('aria-current')) {
      for (const link of links) {
        link.removeAttribute('aria-current');
      }
      last.setAttribute('aria-current', 'true');
    }
  };

  const update = () => {
    frameId = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    atBottom = scrollable > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (atBottom) {
      forceLastActive();
    }
  };

  const requestUpdate = () => {
    if (frameId !== 0) return;
    frameId = window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });

  // 防止 Starlight IntersectionObserver 在底部时覆盖最后一个标题的高亮
  const observer = new MutationObserver(() => {
    if (!atBottom) return;
    forceLastActive();
  });

  for (const link of links) {
    observer.observe(link, { attributes: true, attributeFilter: ['aria-current'] });
  }

  requestUpdate();
}

function bindImageComparisons() {
  const containers = document.querySelectorAll('.dr-img-comp:not([data-dr-init])');

  for (const container of containers) {
    container.dataset.drInit = '1';
    const before = container.querySelector('.dr-img-comp__before');
    const slider = container.querySelector('.dr-img-comp__slider');
    let dragging = false;

    const slide = (e) => {
      if (!dragging) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      before.style.width = `${pct}%`;
      slider.style.left = `${pct}%`;
    };

    container.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });

    container.addEventListener('touchstart', () => {
      dragging = true;
    });

    const stop = () => {
      dragging = false;
    };

    window.addEventListener('mousemove', slide);
    window.addEventListener('touchmove', slide, { passive: true });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
  }
}

function bindImageGalleries() {
  console.log('[DR Image Gallery] 初始化 bindImageGalleries...');
  const galleries = document.querySelectorAll('.dr-img-gallery:not([data-dr-init])');

  for (const gallery of galleries) {
    gallery.dataset.drInit = '1';
    const track = gallery.querySelector('.dr-img-gallery__track');
    const slides = gallery.querySelectorAll('.dr-img-gallery__slide');
    const prevBtn = gallery.querySelector('.dr-img-gallery__prev');
    const nextBtn = gallery.querySelector('.dr-img-gallery__next');
    const dots = gallery.querySelectorAll('.dr-img-gallery__dot');
    const counter = gallery.querySelector('.dr-img-gallery__counter');

    if (!track || slides.length === 0) {
      continue;
    }

    // 动态给所有画廊图片加上 draggable="false"，防止浏览器默认图片拖动干扰我们的滑动
    gallery.querySelectorAll('img').forEach((img) => {
      img.setAttribute('draggable', 'false');
    });

    // 单图降级处理
    if (slides.length <= 1) {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      const dotsContainer = gallery.querySelector('.dr-img-gallery__dots');
      if (dotsContainer) dotsContainer.style.display = 'none';
      if (counter) counter.style.display = 'none';
      continue;
    }

    let index = 0;
    let dragging = false;
    let dragStartX = 0;
    let dragOffset = 0;
    let startX = 0;
    let startY = 0;
    let isTouch = false;
    let dragStarted = false;

    const total = slides.length;

    const goTo = (targetIndex) => {
      index = ((targetIndex % total) + total) % total;
      track.style.transform = `translateX(-${index * 100}%)`;
      
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });

      if (counter) {
        counter.textContent = `${index + 1} / ${total}`;
      }
    };

    const goNext = () => {
      goTo(index + 1);
    };

    const goPrev = () => {
      goTo(index - 1);
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goPrev();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goNext();
      });
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(i);
      });
    });

    gallery.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      }
    });

    const handleDragMove = (clientX) => {
      dragOffset = clientX - dragStartX;
      if (Math.abs(dragOffset) > 5) {
        dragStarted = true;
      }
      const pct = -index * 100 + (dragOffset / gallery.offsetWidth) * 100;
      track.style.transform = `translateX(${pct}%)`;
    };

    const handleMouseMove = (e) => {
      if (!dragging) return;
      handleDragMove(e.clientX);
    };

    const handleTouchMove = (e) => {
      if (!dragging) return;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;

      const deltaX = Math.abs(clientX - startX);
      const deltaY = Math.abs(clientY - startY);

      // 如果横向位移大于纵向位移，则判定为切换图片，阻止页面滚动
      if (deltaX > deltaY && deltaX > 5) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }

      handleDragMove(clientX);
    };

    const handleDragEnd = () => {
      if (!dragging) return;
      dragging = false;

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);

      track.style.transition = '';

      const threshold = gallery.offsetWidth * 0.15;

      if (dragOffset < -threshold) {
        goNext();
      } else if (dragOffset > threshold) {
        goPrev();
      } else {
        goTo(index);
      }

      // 如果确实发生了滑动，我们需要在捕获阶段拦截接下来的 click 事件，防止误触发 Zoomable 放大
      if (dragStarted) {
        const preventClick = (evt) => {
          evt.stopPropagation();
          evt.preventDefault();
          window.removeEventListener('click', preventClick, true);
        };
        window.addEventListener('click', preventClick, true);
      }

      dragOffset = 0;
      dragStarted = false;
    };

    const handleDragStart = (clientX, clientY) => {
      dragging = true;
      dragStarted = false;
      startX = clientX;
      startY = clientY;
      dragStartX = clientX;
      dragOffset = 0;
      track.style.transition = 'none';

      if (isTouch) {
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
      } else {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDragEnd);
      }
    };

    gallery.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.dr-img-gallery__prev, .dr-img-gallery__next, .dr-img-gallery__dot')) {
        return;
      }
      isTouch = false;
      handleDragStart(e.clientX, e.clientY);
    });

    gallery.addEventListener('touchstart', (e) => {
      if (e.target.closest('.dr-img-gallery__prev, .dr-img-gallery__next, .dr-img-gallery__dot')) {
        return;
      }
      isTouch = true;
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    goTo(0);
  }
}

bindReadingProgress();
bindTocEnhancements();
bindImageComparisons();
bindImageGalleries();
bindZoomableImages();
bindArticleVideos();
