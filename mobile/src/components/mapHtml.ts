// Mapa con **MapLibre GL** (tiles vectoriales) dentro de un WebView.
//
// Tiles/estilo: **OpenFreeMap** (https://openfreemap.org) — gratis, sin API key,
// sin registro, sin límite de peticiones y **con uso comercial permitido**
// (es lo que hace falta para publicar en Play Store y monetizar).
// Atribución obligatoria: la añade MapLibre sola desde el estilo.
//
// Antes esto era Leaflet + tiles ráster. Se cambió por:
//   - Esri World Street Map: solo uso NO comercial (sus términos excluyen
//     apps que generen ingresos) → servía para desarrollo, no para publicar.
//   - CARTO Voyager: ahora sus tiles responden "API KEY REQUIRED".
//   - MapTiler free: también solo no comercial; comercial = $30/mes.
// Google Maps queda descartado: la key existe pero el proyecto necesita
// facturación (Google pide tarjeta).
//
// Si algún día hay dinero: MapTiler/Google y se cambia solo la URL del estilo.
// Si OpenFreeMap fallara, se puede autoalojar (publican los datos cada semana).
//
// Nota: maxzoom de los datos = 14; a zoom 15 MapLibre hace "overzoom" (se ve
// algo más suave, pero aceptable para una ciudad).

export interface MapPin {
  id: string;
  name: string;
  kind: 'place' | 'contact';
  lat: number;
  lng: number;
  color: string;
  icon: string;
}

const ML = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const ML_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const STYLE = 'https://tiles.openfreemap.org/styles/bright';

// Estilos comunes (pines con emoji, pulso del punto elegido).
const CSS = `html,body,#m{height:100%;margin:0;padding:0;background:#E8E4D8;overflow:hidden;
-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
.pin{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;
border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);box-sizing:border-box;cursor:pointer;
font-family:system-ui,sans-serif;}
.pin.place{border-radius:50%;}
.pin.contact{border-radius:9px;}
.pickmark{position:relative;width:46px;height:46px;}
.pickmark .ring{position:absolute;inset:0;border-radius:50%;background:rgba(224,122,95,.45);animation:pl 1.3s ease-out infinite;}
.pickmark .em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));}
@keyframes pl{0%{transform:scale(.45);opacity:.95}100%{transform:scale(1.7);opacity:0}}
.maplibregl-ctrl-attrib{font-size:10px;}
.msg{display:flex;align-items:center;justify-content:center;height:100%;padding:24px;
font:14px/1.4 system-ui,sans-serif;color:#8A8F8B;text-align:center;}`;

// Mapa principal: pines por tipo, tamaño según zoom, long-press para crear.
// La navegación dentro del WebView se bloquea desde el nativo
// (onShouldStartLoadWithRequest) para que la atribución no saque de la app.
export function buildMainHtml(centerLat: number, centerLng: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="${ML_CSS}"/>
<style>${CSS}</style></head><body>
<div id="m"></div>
<script src="${ML}"></script>
<script>
function boom(msg){document.getElementById('m').innerHTML='<div class="msg">'+msg+'</div>';}
if(!window.maplibregl){boom('No se pudo cargar el mapa. Revisa tu conexión.');}
else{try{
var map=new maplibregl.Map({
  container:'m',
  style:'${STYLE}',
  center:[${centerLng},${centerLat}],
  zoom:13,
  attributionControl:{compact:true},
  dragRotate:false,
  pitchWithRotate:false,
  touchPitch:false
});
map.touchZoomRotate.disableRotation();
map.keyboard.disableRotation();

var markers=[];
var pts=[];
var pickMarker=null;
var mineMarker=null;

function sizeForZoom(z){return z<=10?12:z<=12?17:z<=13?23:30;}
function applySize(el,s){el.style.width=s+'px';el.style.height=s+'px';el.style.fontSize=Math.round(s*0.55)+'px';}

function render(){
  markers.forEach(function(m){m.remove();});
  markers=[];
  var s=sizeForZoom(map.getZoom());
  pts.forEach(function(p){
    var el=document.createElement('div');
    el.className='pin '+p.kind;
    el.style.background=p.color;
    applySize(el,s);
    el.textContent=p.icon;
    el.title=p.name;
    el.addEventListener('click',function(ev){
      ev.stopPropagation();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',id:p.id}));
    });
    markers.push(new maplibregl.Marker({element:el,anchor:'center'})
      .setLngLat([p.lng,p.lat]).addTo(map));
  });
}
map.on('zoomend',render);

window.setMarkers=function(json,fit){
  pts=JSON.parse(json);
  render();
  if(fit!==false&&pts.length>0){
    var b=new maplibregl.LngLatBounds();
    pts.forEach(function(p){b.extend([p.lng,p.lat]);});
    if(!b.isEmpty()){
      map.fitBounds(b,{padding:{top:170,bottom:90,left:50,right:50},maxZoom:15,duration:0});
    }
  }
};
window.refresh=function(){map.resize();};
window.flyTo=function(lat,lng){map.flyTo({center:[lng,lat],zoom:15});};
window.zoomBy=function(d){map.setZoom(map.getZoom()+d);};

// Punto elegido (mantener presionado): marca visible con emoji y pulso.
window.showPick=function(lat,lng){
  if(pickMarker){pickMarker.setLngLat([lng,lat]);}
  else{
    var el=document.createElement('div');
    el.className='pickmark';
    el.innerHTML='<div class="ring"></div><div class="em">📍</div>';
    pickMarker=new maplibregl.Marker({element:el,anchor:'center',interactive:false})
      .setLngLat([lng,lat]).addTo(map);
  }
  map.panTo([lng,lat],{duration:400});
};
window.clearPick=function(){if(pickMarker){pickMarker.remove();pickMarker=null;}};

window.showMine=function(lat,lng){
  if(mineMarker){mineMarker.setLngLat([lng,lat]);}
  else{
    var el=document.createElement('div');
    el.style.cssText='width:16px;height:16px;border-radius:50%;background:#2E7CF6;'+
      'border:3px solid #fff;box-shadow:0 0 0 2px rgba(46,124,246,.35),0 2px 6px rgba(0,0,0,.3);box-sizing:border-box';
    mineMarker=new maplibregl.Marker({element:el,anchor:'center',interactive:false})
      .setLngLat([lng,lat]).addTo(map);
  }
  map.flyTo({center:[lng,lat],zoom:15});
};

map.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'bg'}));});
map.on('contextmenu',function(e){
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'create',lat:e.lngLat.lat,lng:e.lngLat.lng}));
});

// Mantener presionado (touch y mouse) avisa al nativo para crear aquí.
// Ojo: en Android el "touchcancel" llega al abrir el menú de selección (~500 ms)
// y cancelaba el pulsado; por eso ya no se escucha y el CSS quita la selección.
var pressT=null,pressX=0,pressY=0;
function cancel(){if(pressT){clearTimeout(pressT);pressT=null;}}
function arm(x,y){
  cancel();
  pressX=x;pressY=y;
  pressT=setTimeout(function(){
    pressT=null;
    var r=map.getCanvas().getBoundingClientRect();
    var ll=map.unproject([x-r.left,y-r.top]);
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'create',lat:ll.lat,lng:ll.lng}));
  },550);
}
var c=map.getCanvasContainer();
c.addEventListener('touchstart',function(e){
  if(e.touches.length!==1){cancel();return;}
  var t=e.touches[0];arm(t.clientX,t.clientY);
},{passive:true});
c.addEventListener('touchmove',function(e){
  if(!pressT)return;
  var t=e.touches[0];
  if(!t||Math.abs(t.clientX-pressX)>12||Math.abs(t.clientY-pressY)>12)cancel();
},{passive:true});
c.addEventListener('touchend',cancel,{passive:true});
c.addEventListener('mousedown',function(e){if(e.button===0)arm(e.clientX,e.clientY);});
c.addEventListener('mousemove',function(e){
  if(!pressT)return;
  if(Math.abs(e.clientX-pressX)>12||Math.abs(e.clientY-pressY)>12)cancel();
});
c.addEventListener('mouseup',cancel);

map.on('load',function(){map.resize();});
setTimeout(function(){map.resize();},300);
}catch(err){boom('No se pudo iniciar el mapa: '+err);}}
</script></body></html>`;
}

// Mini-mapa con un pin arrastrable. Avisa {type:'move',lat,lng} al soltar o tocar.
export function buildPickerHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="${ML_CSS}"/>
<style>${CSS}</style></head><body>
<div id="m"></div>
<script src="${ML}"></script>
<script>
function boom(msg){document.getElementById('m').innerHTML='<div class="msg">'+msg+'</div>';}
if(!window.maplibregl){boom('No se pudo cargar el mapa.');}
else{try{
var map=new maplibregl.Map({
  container:'m',
  style:'${STYLE}',
  center:[${lng},${lat}],
  zoom:15,
  attributionControl:{compact:true},
  dragRotate:false,
  pitchWithRotate:false,
  touchPitch:false
});
map.touchZoomRotate.disableRotation();
var mk=new maplibregl.Marker({draggable:true,color:'#E07A5F'}).setLngLat([${lng},${lat}]).addTo(map);
function send(){
  var p=mk.getLngLat();
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'move',lat:p.lat,lng:p.lng}));
}
mk.on('dragend',send);
map.on('click',function(e){mk.setLngLat(e.lngLat);send();});
window.setPoint=function(la,ln){mk.setLngLat([ln,la]);map.jumpTo({center:[ln,la],zoom:15});};
setTimeout(function(){map.resize();},300);
}catch(err){boom('No se pudo iniciar el mapa: '+err);}}
</script></body></html>`;
}

// Vista estática de un punto (detalle de contacto). Sin interacción.
export function buildViewHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="${ML_CSS}"/>
<style>${CSS}</style></head><body>
<div id="m"></div>
<script src="${ML}"></script>
<script>
function boom(msg){document.getElementById('m').innerHTML='<div class="msg">'+msg+'</div>';}
if(!window.maplibregl){boom('No se pudo cargar el mapa.');}
else{try{
var map=new maplibregl.Map({
  container:'m',
  style:'${STYLE}',
  center:[${lng},${lat}],
  zoom:15,
  interactive:false,
  attributionControl:{compact:true}
});
new maplibregl.Marker({color:'#E07A5F'}).setLngLat([${lng},${lat}]).addTo(map);
setTimeout(function(){map.resize();},300);
}catch(err){boom('No se pudo iniciar el mapa: '+err);}}
</script></body></html>`;
}
