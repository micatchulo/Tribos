javascript:/*
 * TRIBOS — Menu de Planeamento (protótipo aberto e auditável)
 * Versão: 0.1.0
 *
 * IMPORTANTE: candidato a submissão/revisão; não executar em mundos PT sem aprovação explícita.
 * Apenas organização local, tarefas manuais e cálculos estimados. Não lê o DOM do jogo,
 * não envia pedidos de rede, não interage com a praça de reunião e nunca envia tropas.
 * Os valores de velocidade são configuráveis e dependem das regras de cada mundo.
 */
(()=>{
  'use strict';
  const ROOT_ID = 'tw-planner-menu-prototype';
  const STORE_KEY = 'tw_planner_menu_v1_' + (location.hostname || 'offline');
  const existing = document.getElementById(ROOT_ID);
  if (existing) { existing.remove(); return; }

  const UNIT_SPEEDS = {
    spear:18, sword:22, axe:18, archer:18, spy:9,
    light:10, marcher:10, heavy:11, ram:30, catapult:30, noble:35
  };
  const UNIT_LABELS = {
    spear:'Lanceiro', sword:'Espadachim', axe:'Machadeiro', archer:'Arqueiro', spy:'Batedor',
    light:'Cavalaria leve', marcher:'Arqueiro a cavalo', heavy:'Cavalaria pesada', ram:'Ariete',
    catapult:'Catapulta', noble:'Nobre'
  };
  const RESOURCE_LABELS = {wood:'Madeira', clay:'Argila', iron:'Ferro'};
  const DEFAULT_GROUPS = ['Atacar','Defender','Players','Aldeias bárbaras'];
  const DEFAULT_DATA = {
    version:1,
    settings:{worldSpeed:1, unitSpeed:1, speeds:{...UNIT_SPEEDS}},
    groups:[...DEFAULT_GROUPS],
    villages:[]
  };
  let data = loadData();
  let activeTab = 'painel';
  let activeGroup = 'Todas';
  let snipeResult = null;
  let notice = '';

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function loadData(){
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return clone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.villages) || !Array.isArray(parsed.groups)) return clone(DEFAULT_DATA);
      parsed.settings = parsed.settings || clone(DEFAULT_DATA.settings);
      parsed.settings.speeds = {...UNIT_SPEEDS, ...(parsed.settings.speeds || {})};
      parsed.groups = parsed.groups.length ? parsed.groups : [...DEFAULT_GROUPS];
      return parsed;
    } catch (e) { return clone(DEFAULT_DATA); }
  }
  function save(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch(e){ notice = 'Não foi possível guardar localmente. Verifica as permissões/armazenamento do navegador.'; }
  }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function num(v, fallback=0){ const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function int(v, fallback=0){ return Math.max(0, Math.floor(num(v, fallback))); }
  function fmt(n){ return Math.round(n).toLocaleString('pt-PT'); }
  function id(){ return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function villageById(villageId){ return data.villages.find(v => v.id === villageId); }
  function selectedVillageId(){ return activeVillageId || data.villages[0]?.id || ''; }
  function coord(v){ return `${v.x}|${v.y}`; }
  function coordDistance(x1,y1,x2,y2){ return Math.sqrt(Math.pow(num(x1)-num(x2),2)+Math.pow(num(y1)-num(y2),2)); }
  function travelMinutes(unit, distance){
    const base = num(data.settings.speeds[unit], UNIT_SPEEDS[unit] || 18);
    const world = num(data.settings.worldSpeed,1);
    const unitSpeed = num(data.settings.unitSpeed,1);
    if (base <= 0 || world <= 0 || unitSpeed <= 0) throw new Error('As velocidades têm de ser superiores a zero.');
    return distance * base / world / unitSpeed;
  }
  function localDate(value){ const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  function localInputDate(d){
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function dateLabel(d){ return d.toLocaleString('pt-PT',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
  function villageOptions(selected=''){
    return '<option value="">— Selecionar aldeia —</option>' + data.villages.map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(v.name)} (${coord(v)})</option>`).join('');
  }
  function groupOptions(selected=''){
    return data.groups.map(g=>`<option value="${esc(g)}" ${g===selected?'selected':''}>${esc(g)}</option>`).join('');
  }
  function groupTabs(){
    const all = ['Todas',...data.groups];
    return `<div class="twpm-groups">${all.map(g=>`<button class="twpm-chip ${activeGroup===g?'on':''}" data-action="filterGroup" data-group="${esc(g)}">${esc(g)}${g==='Todas'?'':` <small>(${data.villages.filter(v=>v.group===g).length})</small>`}</button>`).join('')}</div>`;
  }
  function input(label,name,value='',type='text',extra=''){
    return `<label class="twpm-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label>`;
  }
  function select(label,name,options){ return `<label class="twpm-field"><span>${esc(label)}</span><select name="${esc(name)}">${options}</select></label>`; }
  function empty(msg){ return `<div class="twpm-empty">${esc(msg)}</div>`; }
  function villageList(){
    const list=data.villages.filter(v=>activeGroup==='Todas'||v.group===activeGroup);
    if(!list.length) return empty('Ainda não existem aldeias neste grupo. Adiciona uma no formulário abaixo.');
    return `<div class="twpm-list">${list.map(v=>`<article class="twpm-village"><div class="twpm-vtop"><strong>${esc(v.name)}</strong><span class="twpm-tag">${esc(v.group)}</span></div><div class="twpm-muted">${coord(v)} · ${esc(v.type||'Aldeia')}</div><div class="twpm-actions"><button data-action="editVillage" data-id="${esc(v.id)}">Editar</button><button data-action="deleteVillage" data-id="${esc(v.id)}" class="danger">Eliminar</button></div></article>`).join('')}</div>`;
  }
  function renderPainel(){
    const tasks=data.villages.flatMap(v=>(v.tasks||[]).map(t=>({...t,village:v})));
    const pending=tasks.filter(t=>!t.done);
    const totalTroops=data.villages.reduce((sum,v)=>sum+Object.values(v.troops||{}).reduce((a,b)=>a+int(b),0),0);
    return `<section class="twpm-grid"><div class="twpm-stat"><b>${data.villages.length}</b><span>Aldeias guardadas</span></div><div class="twpm-stat"><b>${data.groups.length}</b><span>Grupos</span></div><div class="twpm-stat"><b>${fmt(totalTroops)}</b><span>Tropas registadas</span></div><div class="twpm-stat"><b>${pending.length}</b><span>Tarefas pendentes</span></div></section>
      <h3>Progresso das aldeias</h3><p class="twpm-muted">Regista metas por aldeia, como subir edifícios, recrutar tropas ou preparar recursos. A conclusão é manual.</p>
      ${data.villages.length?`<div class="twpm-list">${data.villages.map(v=>{const ts=v.tasks||[],done=ts.filter(t=>t.done).length,pct=ts.length?Math.round(done/ts.length*100):0;return `<article class="twpm-village"><div class="twpm-vtop"><strong>${esc(v.name)} (${coord(v)})</strong><span>${pct}%</span></div><div class="twpm-progress"><i style="width:${pct}%"></i></div><div class="twpm-muted">${done}/${ts.length} tarefas concluídas</div>${ts.slice(0,3).map(t=>`<label class="twpm-task"><input type="checkbox" data-action="toggleTask" data-village="${esc(v.id)}" data-task="${esc(t.id)}" ${t.done?'checked':''}> ${esc(t.label)}</label>`).join('')||'<div class="twpm-muted">Sem tarefas definidas.</div>'}</article>`}).join('')}</div>`:empty('Começa por adicionar as tuas aldeias na aba “Vilas”.')}
      <form data-form="addTask" class="twpm-form"><h4>Nova tarefa de progresso</h4>${select('Aldeia','villageId',villageOptions())}${input('Objetivo','label','','text','required maxlength="100"')}<button class="primary" type="submit">Adicionar tarefa</button></form>`;
  }
  function renderVilas(){
    return `${groupTabs()}<div class="twpm-row"><button data-action="addGroup">+ Novo grupo</button><button data-action="renameGroup">Renomear grupo ativo</button></div>${villageList()}
      <form data-form="addVillage" class="twpm-form"><h3>Adicionar aldeia</h3><div class="twpm-two">${input('Nome','name','','text','required maxlength="80"')}${input('Coordenada X','x','','number','required min="0" max="999"')}</div><div class="twpm-two">${input('Coordenada Y','y','','number','required min="0" max="999"')}${select('Grupo','group',groupOptions(data.groups.includes(activeGroup)?activeGroup:data.groups[0]))}</div>${select('Tipo','type',['Aldeia própria','Jogador','Bárbara','Alvo de ataque','Apoio/defesa'].map(x=>`<option>${x}</option>`).join(''))}<button class="primary" type="submit">Guardar aldeia</button></form>
      <div class="twpm-row"><button data-action="export">Exportar cópia de segurança</button><button data-action="import">Importar cópia de segurança</button></div>`;
  }
  function renderRecursos(){
    const v=villageById(selectedVillageId());
    if(!data.villages.length) return empty('Adiciona primeiro uma aldeia na aba “Vilas”.');
    const r=v.resources||{wood:0,clay:0,iron:0,cap:10000,prodWood:0,prodClay:0,prodIron:0};
    const recs=['wood','clay','iron'].map(k=>{
      const stock=int(r[k]),prod=num(r['prod'+k[0].toUpperCase()+k.slice(1)]),cap=int(r.cap,10000);
      const hrs=prod>0?Math.max(0,(cap-stock)/prod):null;
      return `<div class="twpm-resource"><b>${RESOURCE_LABELS[k]}</b><span>${fmt(stock)} / ${fmt(cap)}</span><small>${fmt(prod)} por hora · ${hrs===null?'produção não definida':hrs===0?'armazém cheio':`cheio em ${hrs.toFixed(1)} h`}</small></div>`;
    }).join('');
    return `<form data-form="selectVillage" class="twpm-form compact">${select('Aldeia','villageId',villageOptions(v.id))}<button type="submit">Selecionar</button></form><h3>Recursos — ${esc(v.name)}</h3><div class="twpm-resource-grid">${recs}</div>
      <form data-form="saveResources" class="twpm-form"><input type="hidden" name="villageId" value="${esc(v.id)}"><h4>Atualizar valores manualmente</h4><div class="twpm-three">${input('Madeira','wood',r.wood??0,'number','min="0"')}${input('Argila','clay',r.clay??0,'number','min="0"')}${input('Ferro','iron',r.iron??0,'number','min="0"')}</div>${input('Capacidade do armazém','cap',r.cap??10000,'number','min="1"')}<div class="twpm-three">${input('Madeira/h','prodWood',r.prodWood??0,'number','min="0"')}${input('Argila/h','prodClay',r.prodClay??0,'number','min="0"')}${input('Ferro/h','prodIron',r.prodIron??0,'number','min="0"')}</div><button class="primary" type="submit">Guardar recursos</button></form><p class="twpm-muted">Projeção simplificada: não considera saques, mercado, bónus, filas de construção nem alterações de produção.</p>`;
  }
  function renderTropas(){
    const v=villageById(selectedVillageId());
    if(!data.villages.length) return empty('Adiciona primeiro uma aldeia na aba “Vilas”.');
    const troops=v.troops||{};
    const fields=Object.keys(UNIT_LABELS).map(k=>input(UNIT_LABELS[k],k,troops[k]||0,'number','min="0" step="1"')).join('');
    const total=Object.values(troops).reduce((a,b)=>a+int(b),0);
    return `<form data-form="selectVillage" class="twpm-form compact">${select('Aldeia','villageId',villageOptions(v.id))}<button type="submit">Selecionar</button></form><h3>Tropas — ${esc(v.name)}</h3><div class="twpm-stat inline"><b>${fmt(total)}</b><span>unidades registadas (manual)</span></div><form data-form="saveTroops" class="twpm-form"><input type="hidden" name="villageId" value="${esc(v.id)}"><div class="twpm-two">${fields}</div><button class="primary" type="submit">Guardar efetivos</button></form><p class="twpm-muted">Este registo não é sincronizado com o jogo. Atualiza-o manualmente para evitar decisões baseadas em números desatualizados.</p>`;
  }
  function renderSnipes(kind){
    const def=kind==='defesa';
    const now=new Date(Date.now()+3600000); now.setSeconds(0,0);
    const firstVillage=data.villages[0];
    return `<h3>${def?'Snipe defensivo':'Snipe ofensivo'} — planeador</h3><p class="twpm-muted">Calcula a hora de partida. Não cria comandos nem envia ataques/apoios. Confirma as velocidades nas regras do teu mundo.</p>
      <form data-form="calcSnipe" class="twpm-form"><input type="hidden" name="kind" value="${kind}"><div class="twpm-two">${input('Origem X','sx',firstVillage?.x??'','number','required min="0" max="999" step="1"')}${input('Origem Y','sy',firstVillage?.y??'','number','required min="0" max="999"')}</div><div class="twpm-two">${input('Alvo X','tx','','number','required min="0" max="999"')}${input('Alvo Y','ty','','number','required min="0" max="999"')}</div>${select('Unidade que determina a velocidade','unit',Object.keys(UNIT_LABELS).map(k=>`<option value="${k}" ${k==='light'?'selected':''}>${UNIT_LABELS[k]}</option>`).join(''))}${select(def?'Tipo de operação':'Tipo de ataque planeado','planType',(def?['Snipe de apoio','Reforço coordenado','Substituição de apoio','Apoio com margem de segurança']:['Fake','Nuke','Nobre','Arietes','Catapultas','Ataque misto']).map(x=>`<option>${x}</option>`).join(''))}${input(def?'Hora do impacto inimigo':'Hora de chegada pretendida','arrival',localInputDate(now),'datetime-local','required')}${def?input('Segundos antes do impacto','leadSeconds',1,'number','min="0" max="3600"') : ''}<button class="primary" type="submit">Calcular hora de partida</button></form>
      ${snipeResult&&snipeResult.kind===kind?`<div class="twpm-result"><h4>Resultado estimado</h4><b>Partida sugerida: ${esc(dateLabel(snipeResult.launch))}</b><p>Distância: ${snipeResult.distance.toFixed(2)} campos</p><p>Tempo de viagem: ${snipeResult.minutes.toFixed(2)} min</p><p>Chegada calculada: ${esc(dateLabel(snipeResult.arrival))}</p><p>Plano: ${esc(snipeResult.planType)} · ${esc(UNIT_LABELS[snipeResult.unit])}</p><button data-action="copyResult">Mostrar texto para copiar</button></div>`:''}
      <p class="twpm-warning">A hora é uma estimativa matemática. Arredondamentos, configurações do mundo, unidades especiais e latência podem alterar o resultado. Não uses o cálculo como garantia de snipe ao segundo.</p>`;
  }
  function renderConfig(){
    const speeds=Object.keys(UNIT_LABELS).map(k=>input(UNIT_LABELS[k]+' (min/campo base)',k,data.settings.speeds[k],'number','min="0.01" step="0.01"')).join('');
    return `<h3>Configuração e dados</h3><form data-form="saveSettings" class="twpm-form"><div class="twpm-two">${input('Velocidade do mundo','worldSpeed',data.settings.worldSpeed,'number','min="0.01" step="0.01" required')}${input('Velocidade das unidades','unitSpeed',data.settings.unitSpeed,'number','min="0.01" step="0.01" required')}</div><details><summary>Velocidades base por unidade</summary><div class="twpm-two">${speeds}</div></details><button class="primary" type="submit">Guardar configurações</button></form>
      <h4>Grupos de aldeias</h4><p class="twpm-muted">Cria e renomeia grupos na aba Vilas. Alterações guardam-se apenas neste navegador e neste domínio.</p><div class="twpm-row"><button data-action="addGroup">+ Novo grupo</button><button data-action="renameGroup">Renomear grupo ativo</button><button data-action="reset" class="danger">Repor dados locais</button></div>
      <h4>Cópia de segurança</h4><div class="twpm-row"><button data-action="export">Exportar JSON</button><button data-action="import">Importar JSON</button></div><p class="twpm-muted">O armazenamento local pode desaparecer se limpares os dados do site. Exporta cópias de segurança periodicamente.</p>
      <h4>Limites desta versão</h4><ul><li>Sem leitura automática de aldeias, tropas ou relatórios.</li><li>Sem pedidos de rede, sem automatização de cliques e sem envio de comandos.</li><li>Recursos e tropas são introduzidos manualmente.</li></ul>`;
  }
  const TAB_LABELS={painel:'Visão geral',vilas:'Vilas',recursos:'Recursos',tropas:'Tropas',ataque:'Snipe ataque',defesa:'Snipe defesa',config:'Config.'};
  function renderBody(){
    if(activeTab==='painel') return renderPainel();
    if(activeTab==='vilas') return renderVilas();
    if(activeTab==='recursos') return renderRecursos();
    if(activeTab==='tropas') return renderTropas();
    if(activeTab==='ataque') return renderSnipes('ataque');
    if(activeTab==='defesa') return renderSnipes('defesa');
    return renderConfig();
  }
  const root=document.createElement('div'); root.id=ROOT_ID;
  root.innerHTML=`<style>
  #${ROOT_ID}{position:fixed;z-index:2147483000;right:12px;top:12px;font:13px/1.45 Arial,sans-serif;color:#e8edf2;pointer-events:none}
  #${ROOT_ID} *{box-sizing:border-box} #${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} select,#${ROOT_ID} summary{font:inherit}
  #${ROOT_ID} .twpm-launch{pointer-events:auto;border:1px solid #637485;background:#182a3a;color:#fff;border-radius:9px;padding:9px 13px;cursor:pointer;box-shadow:0 4px 16px #0005}
  #${ROOT_ID} .twpm-panel{display:none;pointer-events:auto;width:min(510px,calc(100vw - 24px));max-height:calc(100vh - 64px);overflow:hidden;background:#14202b;border:1px solid #586977;border-radius:12px;box-shadow:0 12px 40px #0009;margin-top:8px}
  #${ROOT_ID} .twpm-head{padding:12px 14px;background:#223849;display:flex;align-items:center;justify-content:space-between;gap:8px} #${ROOT_ID} .twpm-head strong{font-size:15px} #${ROOT_ID} .twpm-close{background:transparent;border:0;color:#fff;font-size:21px;cursor:pointer}
  #${ROOT_ID} .twpm-tabs{display:flex;gap:4px;overflow:auto;padding:8px;background:#101a23;border-bottom:1px solid #364956} #${ROOT_ID} .twpm-tabs button{white-space:nowrap;background:#253543;color:#dbe4eb;border:1px solid #405665;padding:6px 8px;border-radius:6px;cursor:pointer} #${ROOT_ID} .twpm-tabs button.on{background:#d5e4ee;color:#14202b}
  #${ROOT_ID} .twpm-content{padding:13px;overflow:auto;max-height:calc(100vh - 166px)} #${ROOT_ID} h3{margin:4px 0 8px;font-size:15px} #${ROOT_ID} h4{margin:12px 0 7px;font-size:13px} #${ROOT_ID} p{margin:7px 0} #${ROOT_ID} .twpm-muted{color:#acbac5;font-size:12px} #${ROOT_ID} .twpm-warning{border-left:3px solid #d7a94b;padding:7px 9px;background:#302b20;color:#f1d9a7;font-size:12px}
  #${ROOT_ID} .twpm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px} #${ROOT_ID} .twpm-stat{display:flex;flex-direction:column;gap:2px;background:#233646;border:1px solid #3b5363;padding:10px;border-radius:8px} #${ROOT_ID} .twpm-stat b{font-size:20px} #${ROOT_ID} .twpm-stat span{font-size:11px;color:#bdcbd5} #${ROOT_ID} .twpm-stat.inline{display:inline-flex;flex-direction:row;align-items:center;gap:10px;padding:7px 10px;margin:3px 0 8px}
  #${ROOT_ID} .twpm-form{border:1px solid #3b4d5a;background:#192935;border-radius:8px;padding:10px;margin:10px 0} #${ROOT_ID} .twpm-form.compact{display:flex;align-items:end;gap:8px} #${ROOT_ID} .twpm-field{display:flex;flex-direction:column;gap:4px;min-width:0;margin:5px 0} #${ROOT_ID} .twpm-field span{font-size:11px;color:#bfcbd4} #${ROOT_ID} input,#${ROOT_ID} select{width:100%;min-width:0;padding:7px;border:1px solid #516777;border-radius:5px;background:#0f1a22;color:#eef4f8} #${ROOT_ID} input[type=checkbox]{width:auto} #${ROOT_ID} .twpm-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px} #${ROOT_ID} .twpm-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px} #${ROOT_ID} button{border:1px solid #526a79;background:#263d4d;color:#f2f5f7;border-radius:5px;padding:6px 9px;cursor:pointer} #${ROOT_ID} button.primary{background:#d7e8f1;color:#132432;border-color:#a9bfcc;font-weight:bold} #${ROOT_ID} button.danger{border-color:#9c5d5a;color:#ffc9c4} #${ROOT_ID} .twpm-row,#${ROOT_ID} .twpm-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0} #${ROOT_ID} .twpm-groups{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0} #${ROOT_ID} .twpm-chip{font-size:11px} #${ROOT_ID} .twpm-chip.on{background:#d7e8f1;color:#132432} #${ROOT_ID} .twpm-list{display:flex;flex-direction:column;gap:7px;margin:8px 0} #${ROOT_ID} .twpm-village{border:1px solid #3b5363;border-radius:7px;padding:9px;background:#1c2c38} #${ROOT_ID} .twpm-vtop{display:flex;justify-content:space-between;gap:8px;align-items:center} #${ROOT_ID} .twpm-tag{border-radius:10px;background:#334c5d;color:#d5e5ee;padding:2px 7px;font-size:10px} #${ROOT_ID} .twpm-empty{border:1px dashed #506475;border-radius:8px;padding:18px;text-align:center;color:#bdcbd5;margin:8px 0} #${ROOT_ID} .twpm-progress{height:7px;border-radius:8px;overflow:hidden;background:#0c171f;margin:6px 0} #${ROOT_ID} .twpm-progress i{display:block;height:100%;background:#77b3a0} #${ROOT_ID} .twpm-task{display:block;margin:6px 0;font-size:12px} #${ROOT_ID} .twpm-resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px} #${ROOT_ID} .twpm-resource{display:flex;flex-direction:column;gap:4px;border:1px solid #3b5363;background:#1c2c38;border-radius:7px;padding:8px;min-width:0} #${ROOT_ID} .twpm-resource span{font-size:12px} #${ROOT_ID} .twpm-resource small{font-size:10px;color:#b4c3ce} #${ROOT_ID} .twpm-result{border:1px solid #5b8479;background:#203b38;border-radius:8px;padding:10px;margin:10px 0;overflow-wrap:anywhere} #${ROOT_ID} .twpm-result p{font-size:12px} #${ROOT_ID} details{border:1px solid #394f5e;padding:8px;border-radius:6px;margin:8px 0} #${ROOT_ID} summary{cursor:pointer} #${ROOT_ID} ul{padding-left:18px;color:#bfccd5;font-size:12px}
  @media(max-width:520px){#${ROOT_ID}{right:6px;top:6px}#${ROOT_ID} .twpm-content{max-height:calc(100vh - 150px)}#${ROOT_ID} .twpm-three{grid-template-columns:1fr}#${ROOT_ID} .twpm-resource-grid{grid-template-columns:1fr}}
  </style><button class="twpm-launch" data-action="toggle">⚔ Menu de Planeamento</button><div class="twpm-panel"><header class="twpm-head"><strong>TRIBOS · Planeamento local</strong><button class="twpm-close" data-action="close" aria-label="Fechar">×</button></header><nav class="twpm-tabs">${Object.entries(TAB_LABELS).map(([k,v])=>`<button data-action="tab" data-tab="${k}" class="${k===activeTab?'on':''}">${v}</button>`).join('')}</nav><main class="twpm-content"></main></div>`;
  document.body.appendChild(root);
  const panel=root.querySelector('.twpm-panel');
  const content=root.querySelector('.twpm-content');
  function render(){
    root.querySelectorAll('[data-action="tab"]').forEach(b=>b.classList.toggle('on',b.dataset.tab===activeTab));
    content.innerHTML=(notice?`<div class="twpm-warning">${esc(notice)}</div>`:'')+renderBody();
    notice='';
  }
  function toast(msg){ notice=msg; render(); }
  function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
  function submitForm(form){
    const f=formData(form);
    try {
      switch(form.dataset.form){
        case 'addVillage': {
          const x=num(f.x,-1), y=num(f.y,-1);
          if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>999||y>999) throw new Error('Coordenadas inválidas. Usa inteiros entre 0 e 999.')
          const name=String(f.name||'').trim(); if(!name) throw new Error('Indica o nome da aldeia.');
          if(data.villages.some(v=>v.x===x&&v.y===y)) throw new Error('Já existe uma aldeia guardada nessas coordenadas.');
          data.villages.push({id:id(),name,x,y,group:data.groups.includes(f.group)?f.group:data.groups[0],type:f.type||'Aldeia própria',resources:{wood:0,clay:0,iron:0,cap:10000,prodWood:0,prodClay:0,prodIron:0},troops:{},tasks:[]});
          activeTab='vilas'; activeGroup=f.group||'Todas'; save(); render(); return;
        }
        case 'selectVillage': activeVillageId=f.villageId; render(); return;
        case 'saveResources': {
          const v=villageById(f.villageId); if(!v) throw new Error('Seleciona uma aldeia válida.');
          v.resources={wood:int(f.wood),clay:int(f.clay),iron:int(f.iron),cap:Math.max(1,int(f.cap,10000)),prodWood:Math.max(0,num(f.prodWood)),prodClay:Math.max(0,num(f.prodClay)),prodIron:Math.max(0,num(f.prodIron))}; save(); toast('Recursos guardados.'); return;
        }
        case 'saveTroops': {
          const v=villageById(f.villageId); if(!v) throw new Error('Seleciona uma aldeia válida.');
          v.troops={}; Object.keys(UNIT_LABELS).forEach(k=>v.troops[k]=int(f[k])); save(); toast('Efetivos guardados.'); return;
        }
        case 'saveSettings': {
          const ws=num(f.worldSpeed), us=num(f.unitSpeed); if(ws<=0||us<=0) throw new Error('As velocidades têm de ser superiores a zero.');
          data.settings.worldSpeed=ws; data.settings.unitSpeed=us;
          Object.keys(UNIT_LABELS).forEach(k=>{const x=num(f[k]);if(x>0)data.settings.speeds[k]=x;}); save(); toast('Configurações guardadas.'); return;
        }
        case 'addTask': {
          const v=villageById(f.villageId); const label=String(f.label||'').trim(); if(!v) throw new Error('Seleciona uma aldeia.'); if(!label) throw new Error('Escreve um objetivo.');
          v.tasks=v.tasks||[];v.tasks.push({id:id(),label,done:false});save();activeTab='painel';toast('Tarefa adicionada.');return;
        }
        case 'calcSnipe': {
          const sx=num(f.sx,-1),sy=num(f.sy,-1),tx=num(f.tx,-1),ty=num(f.ty,-1); if([sx,sy,tx,ty].some(n=>!Number.isInteger(n)||n<0||n>999)) throw new Error('Coordenadas inválidas: usa inteiros entre 0 e 999.');
          const target=localDate(f.arrival); if(!target) throw new Error('Data/hora inválida.');
          const dist=coordDistance(sx,sy,tx,ty); const mins=travelMinutes(f.unit,dist);
          const lead=f.kind==='defesa'?Math.max(0,int(f.leadSeconds,1)):0;
          const desired=new Date(target.getTime()-lead*1000); const launch=new Date(desired.getTime()-mins*60000);
          snipeResult={kind:f.kind,unit:f.unit,planType:f.planType,distance:dist,minutes:mins,arrival:desired,launch}; activeTab=f.kind; render(); return;
        }
      }
    } catch(e){ toast(e.message||'Ocorreu um erro ao guardar.'); }
  }
  let activeVillageId=data.villages[0]?.id||'';
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]'); if(!b)return;
    const a=b.dataset.action;
    if(a==='toggle'){panel.style.display=panel.style.display==='block'?'none':'block';if(panel.style.display==='block')render();}
    else if(a==='close') panel.style.display='none';
    else if(a==='tab'){activeTab=b.dataset.tab;render();}
    else if(a==='filterGroup'){activeGroup=b.dataset.group;render();}
    else if(a==='addGroup'){
      const name=prompt('Nome do novo grupo:'); if(name&&name.trim()) {const n=name.trim();if(data.groups.includes(n))toast('Esse grupo já existe.');else{data.groups.push(n);activeGroup=n;save();render();}}
    }
    else if(a==='renameGroup'){
      if(activeGroup==='Todas'||!data.groups.includes(activeGroup)){toast('Seleciona primeiro um grupo específico.');return;}
      const name=prompt('Novo nome para “'+activeGroup+'”: ',activeGroup); if(name&&name.trim()){const n=name.trim();if(data.groups.includes(n)){toast('Já existe um grupo com esse nome.');return;}const old=activeGroup;data.groups=data.groups.map(g=>g===old?n:g);data.villages.forEach(v=>{if(v.group===old)v.group=n;});activeGroup=n;save();render();}
    }
    else if(a==='editVillage'){
      const v=villageById(b.dataset.id);if(!v)return;
      const name=prompt('Nome da aldeia:',v.name);if(name===null)return;
      const group=prompt('Grupo ('+data.groups.join(', ')+'):',v.group);if(group===null)return;
      if(!name.trim()){toast('O nome não pode ficar vazio.');return;}if(!data.groups.includes(group.trim())){toast('Grupo não encontrado. Cria-o primeiro, se necessário.');return;}
      v.name=name.trim();v.group=group.trim();save();render();
    }
    else if(a==='deleteVillage'){
      const v=villageById(b.dataset.id);if(v&&confirm('Eliminar “'+v.name+'” e os dados locais associados?')){data.villages=data.villages.filter(x=>x.id!==v.id);if(activeVillageId===v.id)activeVillageId=data.villages[0]?.id||'';save();render();}
    }
    else if(a==='toggleTask'){
      const v=villageById(b.dataset.village);const t=(v?.tasks||[]).find(x=>x.id===b.dataset.task);if(t){t.done=b.checked;save();render();}
    }
    else if(a==='export'){
      const txt=JSON.stringify(data,null,2);prompt('Copia o JSON abaixo e guarda-o num ficheiro de texto:',txt);
    }
    else if(a==='import'){
      const txt=prompt('Cola aqui uma cópia JSON anteriormente exportada:');if(!txt)return;
      try{const obj=JSON.parse(txt);if(obj.version!==1||!Array.isArray(obj.villages)||!Array.isArray(obj.groups)||!obj.settings)throw new Error('Formato ou versão inválidos.');
        const ids=new Set();for(const v of obj.villages){if(!v.id||!Number.isFinite(Number(v.x))||!Number.isFinite(Number(v.y))||ids.has(v.id))throw new Error('Há uma aldeia com dados inválidos ou ID duplicado.');ids.add(v.id);}
        data=obj;data.settings.speeds={...UNIT_SPEEDS,...(data.settings.speeds||{})};activeGroup='Todas';activeVillageId=data.villages[0]?.id||'';save();toast('Cópia importada.');
      }catch(err){toast('Importação falhou: '+err.message);}
    }
    else if(a==='reset'){
      if(confirm('Apagar todas as aldeias, grupos e configurações guardados neste navegador?')){data=clone(DEFAULT_DATA);activeGroup='Todas';activeVillageId='';snipeResult=null;save();toast('Dados locais repostos.');}
    }
    else if(a==='copyResult'&&snipeResult){prompt('Copia este resumo manual:',`Plano: ${snipeResult.planType}\nUnidade: ${UNIT_LABELS[snipeResult.unit]}\nDistância: ${snipeResult.distance.toFixed(2)} campos\nViagem: ${snipeResult.minutes.toFixed(2)} min\nPartida: ${dateLabel(snipeResult.launch)}\nChegada planeada: ${dateLabel(snipeResult.arrival)}`);}
  });
  root.addEventListener('submit',e=>{const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();submitForm(form);});
  root.addEventListener('change',e=>{
    if(e.target.matches('#twpm-village-select')){activeVillageId=e.target.value;render();}
    if(e.target.matches('input[type="checkbox"][data-action="toggleTask"]')){const v=villageById(e.target.dataset.village);const t=(v?.tasks||[]).find(x=>x.id===e.target.dataset.task);if(t){t.done=e.target.checked;save();render();}}
  });
  // Exposição mínima de funções puras para permitir testes/auditoria do código.
  window.TribosMenuPlannerCore={coordDistance,travelMinutes,localDate,UNIT_SPEEDS:{...UNIT_SPEEDS}};
  render();
})();
