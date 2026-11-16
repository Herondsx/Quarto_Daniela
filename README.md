# Quarto da Daniela — 3D

Modelo 3D interativo do quarto da Daniela para testar e comparar posições dos móveis.
Funciona no celular e no computador, sem instalar nada.

**Site:** https://herondsx.github.io/quarto_daniela/ (depois de ativar o GitHub Pages, ver abaixo)

## O que dá para fazer

- **3 visualizações:** 3D (gira e dá zoom), **Planta** (vista de cima, igual ao desenho) e **Da porta** (o mesmo ângulo da foto).
- **Mover os móveis:** no computador, clique e arraste. No celular, toque no móvel para selecionar e depois arraste.
  Botões para **girar 90°**, **encostar na parede** e ajuste fino de 5 cm. A TV desliza pelas paredes e sobe/desce.
- **Fixos:** armário, porta e janela não saem do lugar.
- **Sugestões prontas:** "Como está hoje" + 3 sugestões de layout (incluindo a cabeceira ilhada com a TV no canto), cada uma com prós e contras e uma miniatura da planta.
- **Parede da TV:** tem a moldura de gesso no meio da parede (com o papel listrado embaixo). Móveis baixos (mesa,
  criado-mudo) cabem embaixo dela; se algo alto, como a estante, for encostado ali, o site avisa que seria preciso
  tirar a moldura.
- **Avisos automáticos:** móveis sobrepostos, porta bloqueada, janela tampada, móvel alto na moldura de gesso, pouco
  espaço para a cadeira/gavetas/portas do armário, passagens menores que 40 cm e se a TV fica de frente para a cama.
- **Medidas editáveis:** as medidas atuais são **estimativas** (feitas a partir da foto e do desenho; a única medida
  informada foi os 50 cm no pé da cama). Na aba **Medidas** dá para corrigir tudo com os valores da trena — as
  sugestões e os avisos se recalculam sozinhos.
- **Salvar e compartilhar:** salve seus próprios layouts, desfaça mudanças, baixe uma imagem e gere um link que abre
  exatamente o mesmo layout em outro celular/PC.

## Publicar no GitHub Pages

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Em **Branch**, selecione o branch com estes arquivos (por exemplo `main`) e a pasta **`/ (root)`** → **Save**.
4. Em 1–2 minutos o site fica em `https://herondsx.github.io/quarto_daniela/`.

Não tem etapa de build: é HTML + CSS + JavaScript puro. O three.js já está incluído na pasta `vendor/`,
então o site não depende de CDN.

## Rodar no computador

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000 (precisa ser por um servidor; abrir o `index.html` direto não carrega os módulos).

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Página, botões e painel |
| `css/style.css` | Visual (desktop e celular) |
| `js/data.js` | **Medidas padrão, lista de móveis e as sugestões de layout** |
| `js/analysis.js` | Regras dos avisos (sobreposição, porta, janela, passagens…) |
| `js/builders.js` | Modelos 3D do quarto e dos móveis |
| `js/app.js` | Cena 3D, câmeras, arrastar, painel, salvar/compartilhar |
| `vendor/` | three.js r170 (licença MIT) |

### Coordenadas

Tudo em centímetros, visto de cima como no desenho: `x` vai da parede do armário (0) até a parede da janela (`W`),
`z` vai da parede da cabeceira (0) até a parede da TV (`D`). Cada sugestão em `js/data.js` é uma função das medidas,
então para criar uma sugestão nova basta adicionar um item em `PRESETS` usando `put(dims, móvel, rotação, x0, z0)`.
