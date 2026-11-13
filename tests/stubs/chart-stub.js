// Stub mínimo do Chart.js para testes headless (CDN bloqueado no ambiente de teste)
(function(){
  function Chart(canvas,cfg){
    if(!canvas) throw new Error('Chart: canvas nulo');
    this.canvas=canvas;this.config=cfg;this.id=Chart._n++;
    Chart.instances[this.id]=this;
    (window.__charts=window.__charts||[]).push({id:canvas.id,type:cfg.type,datasets:(cfg.data.datasets||[]).map(d=>({label:d.label,n:(d.data||[]).length,data:d.data}))});
  }
  Chart._n=0;Chart.instances={};
  Chart.prototype.destroy=function(){delete Chart.instances[this.id];};
  Chart.prototype.update=function(){};
  Chart.defaults={font:{},color:'',plugins:{legend:{labels:{}}}};
  Chart.register=function(){};
  window.Chart=Chart;
})();
