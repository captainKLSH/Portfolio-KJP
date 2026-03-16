(function(root, factory){
    if(typeof module!=='undefined'&&module.exports){module.exports=factory();}
    else if(typeof define==='function'&&define.amd){define(factory);}
    else{root.BlurText=factory();}
  }(typeof self!=='undefined'?self:this,function(){
 
    function BlurText(mountEl, opts){
      if(!mountEl) throw new Error('BlurText: need a DOM element.');
      var cfg = Object.assign({
        text:               'Blur Text',
        delay:              200,
        animateBy:          'words',
        direction:          'top',
        threshold:          0.1,
        rootMargin:         '0px',
        animationFrom:      null,
        animationTo:        null,
        easing:             function(t){return t;},
        stepDuration:       0.35,
        onAnimationComplete:null
      }, opts||{});
 
      var elements = cfg.animateBy==='words'
        ? cfg.text.split(' ')
        : cfg.text.split('');
 
      /* ── Default keyframe snapshots ── */
      var defaultFrom = cfg.direction==='top'
        ? {filter:'blur(10px)', opacity:0, y:-50}
        : {filter:'blur(10px)', opacity:0, y:50};
 
      var defaultTo = [
        {filter:'blur(5px)',  opacity:0.5, y: cfg.direction==='top'?5:-5},
        {filter:'blur(0px)',  opacity:1,   y: 0}
      ];
 
      var fromSnap = cfg.animationFrom || defaultFrom;
      var toSnaps  = cfg.animationTo   || defaultTo;
 
      var stepCount    = toSnaps.length + 1;
      var totalDuration= cfg.stepDuration * (stepCount - 1);
 
      /* ── Build spans ── */
      elements.forEach(function(seg, i){
        var span = document.createElement('span');
        span.className = 'blur-word';
 
        var content = seg==='\u0020' ? '\u00A0' : seg;
        if(cfg.animateBy==='words' && i < elements.length-1) content += '\u00A0';
        span.textContent = content;
 
        /* Start state */
        span.style.filter    = fromSnap.filter;
        span.style.opacity   = fromSnap.opacity;
        span.style.transform = 'translateY('+fromSnap.y+'px)';
        span.style.transition = [
          'filter '    + totalDuration+'s '+buildEasing(cfg.easing),
          'opacity '   + totalDuration+'s '+buildEasing(cfg.easing),
          'transform ' + totalDuration+'s '+buildEasing(cfg.easing)
        ].join(', ');
 
        mountEl.appendChild(span);
      });
 
      var spans = mountEl.querySelectorAll('.blur-word');
 
      /* ── Animate when in view ── */
      function animateAll(){
        spans.forEach(function(span, i){
          setTimeout(function(){
            /* We step through each toSnap keyframe with equal sub-durations */
            animateSpan(span, i);
          }, i * cfg.delay);
        });
      }
 
      function animateSpan(span, idx){
        /* Walk through each keyframe step */
        toSnaps.forEach(function(snap, si){
          setTimeout(function(){
            if(snap.filter    !== undefined) span.style.filter    = snap.filter;
            if(snap.opacity   !== undefined) span.style.opacity   = snap.opacity;
            if(snap.y         !== undefined) span.style.transform = 'translateY('+snap.y+'px)';
          }, si * cfg.stepDuration * 1000);
        });
 
        /* Fire callback after last span finishes */
        if(idx === spans.length - 1 && cfg.onAnimationComplete){
          var totalMs = (cfg.delay * (spans.length-1)) + (totalDuration * 1000);
          setTimeout(cfg.onAnimationComplete, totalMs);
        }
      }
 
      /* ── IntersectionObserver ── */
      var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            observer.unobserve(mountEl);
            animateAll();
          }
        });
      }, {threshold: cfg.threshold, rootMargin: cfg.rootMargin});
 
      observer.observe(mountEl);
 
      this.destroy = function(){
        observer.disconnect();
        while(mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);
      };
    }
 
    /* Convert a JS easing function to a cubic-bezier string or 'linear' */
    function buildEasing(fn){
      /* If it's the identity, use linear */
      if(fn.toString().indexOf('return t')!==-1 || fn.toString().indexOf('return t;')!==-1) return 'ease-out';
      return 'ease-out';
    }
 
    return BlurText;
  }));
  
  document.addEventListener('DOMContentLoaded', function () {
 
      /* BlurText — animated name */
      new BlurText(document.getElementById('home__name'), {
        text:       'Kiran Jamuna Prasad',
        delay:      150,
        animateBy:  'words',
        direction:  'top',
        stepDuration: 0.38,
        onAnimationComplete: function(){ console.log('Name animation complete!'); }
      })});
