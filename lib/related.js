// Ofertas relacionadas de verdade: compara o NOME do produto (palavras em comum, sinônimos e público)
// em vez de só a categoria. Ex.: bracelete feminino → pulseiras, colares, brincos, berloques…
const STOP = new Set(('de da do das dos e com para por em no na nos nas o a os as um uma kit cor original oficial novo nova ' +
  'tamanho unidade unidades pecas peca pc pcs lancamento promocao oferta premium modelo linha versao preto branco azul ' +
  'vermelho rosa cinza verde amarelo bege marrom dourado prata prateado').split(' '));

// Grupos de produtos parecidos (qualquer palavra do grupo conta como o grupo inteiro)
const GROUPS = {
  joia: 'bracelete pulseira colar corrente gargantilha brinco brincos anel aneis pingente berloque berloques joia joias bijuteria tornozeleira pandora vivara',
  relogio: 'relogio relogios smartwatch smartband',
  calcado: 'tenis sapato sapatenis sandalia chinelo bota botas papete rasteira scarpin sapatilha',
  roupa: 'camiseta camisa blusa regata moletom jaqueta casaco calca bermuda short shorts vestido saia legging cueca calcinha sutia meia meias pijama',
  bolsa: 'bolsa mochila carteira necessaire mala',
  perfume: 'perfume colonia eau parfum toilette body splash desodorante',
  cabelo: 'shampoo condicionador mascara capilar serum cabelo leave finalizador chapinha secador escova modeladora',
  pele: 'skincare hidratante protetor solar serum facial sabonete limpeza acne creme',
  maquiagem: 'maquiagem base batom rimel delineador paleta sombra po corretivo blush',
  celular: 'iphone smartphone celular galaxy redmi xiaomi motorola moto',
  audio: 'fone headphone headset earbuds caixa som soundbar jbl airpods',
  tv: 'tv televisao smart monitor projetor',
  informatica: 'notebook laptop computador pc teclado mouse ssd hd memoria placa processador roteador tablet ipad',
  game: 'console playstation ps5 xbox nintendo switch controle jogo game gamer',
  cozinha: 'airfryer fritadeira panela cafeteira liquidificador batedeira microondas forno geladeira fogao cooktop',
  casa: 'aspirador robo ventilador ar condicionado colchao travesseiro lencol toalha cama sofa',
  ferramenta: 'furadeira parafusadeira ferramenta chave serra lixadeira',
  fitness: 'whey creatina suplemento proteina academia halter bicicleta esteira',
  bebe: 'fralda bebe infantil mamadeira carrinho',
};
const WORD2GROUP = {};
for (const [g, ws] of Object.entries(GROUPS)) for (const w of ws.split(' ')) WORD2GROUP[w] = g;

const FEM = /\b(feminin[oa]s?|mulher(es)?|dela|menina|pandora|vivara)\b/;
const MASC = /\b(masculin[oa]s?|homem|homens|dele|menino)\b/;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const stem = (w) => (w.length > 4 ? w.replace(/(oes|aes|ais|eis|res|es|s)$/, (m) => (m === 'oes' ? 'ao' : m === 'aes' ? 'ao' : m === 'ais' ? 'al' : m === 'eis' ? 'el' : m === 'res' ? 'r' : m === 'es' && !/[rsz]es$/.test(w) ? 'e' : '')) : w);

export function profile(title) {
  const t = norm(title);
  const words = (t.match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+[a-z]{0,3}$/.test(w));
  const toks = new Set(words.map(stem));
  const groups = new Set(words.map((w) => WORD2GROUP[w] || WORD2GROUP[stem(w)]).filter(Boolean));
  const gender = FEM.test(t) ? 'f' : MASC.test(t) ? 'm' : null;
  return { toks, groups, gender };
}

// Devolve as ofertas mais parecidas (só as que fazem sentido); completa com a mesma categoria se faltar
export function related(title, pool, getTitle, { max = 8, sameCat = () => false } = {}) {
  const me = profile(title);
  const scored = pool.map((m) => {
    const o = profile(getTitle(m));
    let s = 0;
    for (const t of o.toks) if (me.toks.has(t)) s += 2;
    for (const g of o.groups) if (me.groups.has(g)) s += 4;
    if (me.gender && o.gender && me.gender !== o.gender) s -= 6; // feminino ≠ masculino
    if (me.gender && o.gender === me.gender) s += 1;
    if (sameCat(m)) s += 1;
    return { m, s };
  });
  const good = scored.filter((x) => x.s >= 4).sort((a, b) => b.s - a.s).map((x) => x.m);
  if (good.length >= 4) return good.slice(0, max);
  const fill = scored.filter((x) => x.s > 0 && x.s < 4 && sameCat(x.m)).sort((a, b) => b.s - a.s).map((x) => x.m);
  return [...good, ...fill].slice(0, max);
}
