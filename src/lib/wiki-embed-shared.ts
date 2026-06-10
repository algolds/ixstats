/**
 * Shared CSS + JS for IxMaps wiki embeds.
 *
 * Mirrors the IxStats MediaWiki PHP extension so both platforms
 * produce identical embed UX. The classic MediaWiki page injects
 * these via addHeadItem(); WikiOS (ArticleRenderer) injects them
 * via client-side <style> + <script>.
 */

const EMBED_BASE = "/maps?embed=true";

export const EMBED_CSS = `
.ix-embed-wrap{position:relative;margin:8px 0;overflow:hidden;border-radius:12px;
  border:1px solid rgba(255,255,255,0.08);background:#0a1628;cursor:pointer}
.ix-embed-wrap iframe{position:absolute;inset:0;border:none;width:100%;height:100%}
.ix-embed-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:8px;transition:background .2s}
.ix-embed-wrap:hover .ix-embed-placeholder{background:rgba(255,255,255,0.03)}
.ix-embed-pin-icon{width:24px;height:24px;border-radius:50% 50% 50% 0;
  background:#3b82f6;transform:rotate(-45deg);opacity:.6}
.ix-embed-coords{font-family:monospace;font-size:12px;color:rgba(255,255,255,.7)}
.ix-embed-hint{font-size:10px;color:rgba(255,255,255,.35)}
.ix-embed-zoom-badge{position:absolute;bottom:8px;right:8px;padding:2px 8px;
  border-radius:8px;border:1px solid rgba(255,255,255,0.1);
  background:rgba(0,0,0,.7);font-size:9px;color:rgba(255,255,255,.4);
  pointer-events:none}
.ix-embed-active .ix-embed-placeholder{display:none}
.ix-embed-active .ix-embed-zoom-badge{display:none}
`;

export const EMBED_JS = `
(function(){
var _ixIframe=null, _ixActiveWrap=null, _ixFullscreenClose=null;
var _ixBase='${EMBED_BASE}';

function deactivate(){
  if(_ixActiveWrap){
    _ixActiveWrap.classList.remove('ix-embed-active');
    var f=_ixActiveWrap.querySelector('iframe');
    if(f){f.remove()}
    _ixActiveWrap=null;
  }
}

function showEmbed(wrap,lat,lng,zoom){
  if(_ixFullscreenClose){_ixFullscreenClose.click();return}
  deactivate();
  var src=_ixBase+'&lat='+lat.toFixed(4)+'&lng='+lng.toFixed(4)+'&zoom='+zoom;
  var f=document.createElement('iframe');
  f.setAttribute('allow','fullscreen');
  f.setAttribute('loading','lazy');
  f.setAttribute('title','IxWorld Map Embed');
  f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:none';
  f.src=src;
  wrap.appendChild(f);
  wrap.classList.add('ix-embed-active');
  _ixActiveWrap=wrap;
}

window._ixCoordsFullscreen=function(lat,lng,zoom){
  if(!_ixIframe||!_ixIframe.isConnected){
    _ixIframe=document.createElement('iframe');
    _ixIframe.setAttribute('allow','fullscreen');
    _ixIframe.setAttribute('loading','eager');
    _ixIframe.setAttribute('title','IxWorld Map Embed');
    _ixIframe.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:none';
    document.body.appendChild(_ixIframe);
    _ixIframe.src=_ixBase;
  }
  var src=_ixBase+'&lat='+lat.toFixed(4)+'&lng='+lng.toFixed(4)+'&zoom='+zoom;
  deactivate();
  if(_ixFullscreenClose){_ixFullscreenClose.remove();_ixFullscreenClose=null}
  _ixIframe.style.cssText='position:fixed;inset:0;z-index:2147483646;width:100vw;height:100vh;border:none';
  _ixIframe.src=src;
  if(_ixIframe.parentElement!==document.body)document.body.appendChild(_ixIframe);
  var c=document.createElement('button');
  c.innerHTML='×';
  c.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:20px;cursor:pointer';
  c.onclick=function(){
    _ixIframe.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:none';
    document.body.appendChild(_ixIframe);
    c.remove();
    _ixFullscreenClose=null;
  };
  document.body.appendChild(c);
  _ixFullscreenClose=c;
};

function init(){
  document.addEventListener('click',function(e){
    var wrap=e.target.closest('.ix-embed-wrap');
    if(wrap&&!wrap.classList.contains('ix-embed-active')){
      var lat=parseFloat(wrap.getAttribute('data-ix-lat'));
      var lng=parseFloat(wrap.getAttribute('data-ix-lng'));
      var zoom=parseInt(wrap.getAttribute('data-ix-zoom'));
      showEmbed(wrap,lat,lng,zoom);
    }
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init,{once:true});
}else{
  init();
}
})();
`;

export const EMBED_PREFETCH = `${EMBED_BASE}`;
