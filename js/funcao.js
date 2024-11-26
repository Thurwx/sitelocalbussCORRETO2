//funcao.js
// Inicializa o Parse
Parse.initialize("arjJzEgN7cooqvlcKclRSbD99VdjMHmrQIptuBMa", "Sj6bYZp9fInqFjtgPlyzaDwRgLKCtqQuYnR453Bc");
Parse.serverURL = "https://parseapi.back4app.com/";

let mymap = null;
let routeControl = null; // Armazena a rota atual exibida
let currentPolyline = null; // Armazena a polilinha atual
let intervalId = null; // Intervalo para realizar a nova busca
let currentIconMarker = null;  // Variável para armazenar o marcador atual
// Variável para armazenar o tempo de inatividade
let idleTime = 0;

// Inicializa o mapa
const initMap = (position = [], sessionMap, zoom) => {
    mymap = L.map(sessionMap, {
        zoomControl: false,  // Remove os controles de zoom (+ e -)
        scrollWheelZoom: true  // Permite zoom com o scroll do mouse
    }).setView(position, zoom);

    // Adicionando a camada de transporte público
    L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}', {
        attribution: '&copy; <a href="https://www.thunderforest.com/maps/transport/">',
        apikey: '22f111fff9184ca791ce78c304a8bb00'  // Insira sua chave de API do Thunderforest
    }).addTo(mymap);

    addMarcadoresFixos();
};
    // Função para adicionar marcadores fixos
    const addMarcadoresFixos = () => {
        // Marcador 1 (Ponto A)
        const marker1 = L.marker([-23.111095, -47.718188]).addTo(mymap);
        marker1.bindPopup("<b>Terminal Rodoviário da Cidade de Tietê-SP Prefeito Oswaldo Rodrigues de Moraes</b><br>Latitude:-23.111095<br>Longitude: -47.718188");

        // Marcador 2 (Ponto B)
        const marker2 = L.marker([-23.101992,  -47.712078]).addTo(mymap);
        marker2.bindPopup("<b>Terminal Germínio Simon</b><br>Latitude: -23.101992<br>Longitude: -47.712078");
    };


// Função para adicionar pontos de rota no mapa
const addPontos = (coordenadas = [], nomeRota, cor) => {
    // Limpa a rota anterior, se existir
    if (routeControl) {
        mymap.removeControl(routeControl);
    }

    // Remove a polilinha anterior, se existir
    if (currentPolyline) {
        mymap.removeLayer(currentPolyline);
    }

    // Converte coordenadas em pontos
    let way_points = coordenadas.map(coord => L.latLng(coord.latitude, coord.longitude));
    let lineColor = cor ?? 'black'; // Define a cor da rota com base no nome

    // Desenhar a nova polilinha entre os pontos
    currentPolyline = L.polyline(way_points, { color: lineColor, weight: 3 }).addTo(mymap);

    // Ajusta o mapa para mostrar todos os pontos da rota
    mymap.fitBounds(currentPolyline.getBounds());
};

// Função para listar as rotas
const listarRotas = async (callback) => {
    const Rota = Parse.Object.extend('Rota');
    const query = new Parse.Query(Rota);
    try {
        const results = await query.find();
        console.log('Rotas encontradas:', results); // Log para verificar as rotas encontradas
        let id_nome = [];
        for (const object of results) {
            id_nome.push({
                id: object.id,
                nome: object.get('name')
            });
        }
        callback(id_nome);
    } catch (error) {
        console.error('Error while fetching Rota', error);
    }
};

// Função para consultar rotas por ID
const consultarRotasPorIs = async (id, callback) => {
    const Rota = Parse.Object.extend('Rota');
    const query = new Parse.Query(Rota);
    
    try {
        const results = await query.equalTo('objectId', id).find();
        
        if (results.length > 0) {
            let rota_selecionada = {
                id: id,
                nome: results[0].get('name'),
                cor: results[0].get('color'),
                path: results[0].get('path')
            };
            callback(rota_selecionada);
        } else {
            callback(null);
        }
    } catch (error) {
        console.error('Error while fetching Rota', error);
        callback(null);
    }
};

const criarIconeSVG = (cor) => {
    // Definindo o conteúdo SVG do ícone com a cor dinâmica
    return L.divIcon({
        className: 'custom-icon', // Adiciona uma classe personalizada ao ícone
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="${cor}" class="bi bi-geo-alt-fill" viewBox="0 0 16 16">
                <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
              </svg>`,
        iconSize: [30, 30],  // Tamanho do ícone
        iconAnchor: [15, 30], // Posição de ancoragem do ícone (na base)
        popupAnchor: [0, -30] // Posição do pop-up, se necessário
    });
};


// Função para consultar o localAtual e atualizar o marcador com a nova coordenada
const consultarLocalAtualPorId = async (id, callback) => {
    const LocalAtual = Parse.Object.extend('Rota'); // Certifique-se de que 'Rota' é a classe que contém 'localAtual'
    const query = new Parse.Query(LocalAtual);
    
    try {
        // Realiza a consulta para pegar o objeto com o ID correspondente
        const results = await query.equalTo('objectId', id).find();

        if (results.length > 0) {
            // Pega o campo 'localAtual' que é um array de coordenadas
            const localAtual = results[0].get('localAtual');
            const corRota = results[0].get('color'); // Pega a cor da rota (supondo que seja um valor de cor válida como string)

            if (localAtual && localAtual.length > 0 && corRota) {
                console.log("Coordenadas de localAtual:", localAtual); // Exibe as coordenadas no console
                console.log("Cor da rota:", corRota); // Exibe a cor da rota

                // Verifica se já existe um ícone no mapa. Se sim, remove ele.
                if (currentIconMarker) {
                    mymap.removeLayer(currentIconMarker);  // Remove o marcador antigo
                }

                // Adiciona o novo marcador com base na primeira coordenada (apenas um ícone por objectId)
                const coord = localAtual[0];  // Aqui, estou pegando apenas a primeira coordenada do array
                const latLng = L.latLng(coord.latitude, coord.longitude);  // Cria um ponto no mapa

                // Cria o novo marcador com o ícone SVG personalizado e a cor da rota
                currentIconMarker = L.marker(latLng, { icon: criarIconeSVG(corRota) }).addTo(mymap);

                callback(localAtual); // Passa as coordenadas para o callback
            } else {
                console.log("Não há coordenadas no campo 'localAtual' ou cor na coluna 'color'.");
                callback([]); // Retorna um array vazio caso não haja coordenadas
            }
        } else {
            console.log("Objeto não encontrado para o ID fornecido.");
            callback(null); // Caso não encontre o objeto
        }
    } catch (error) {
        console.error('Erro ao consultar localAtual:', error);
        callback(null);
    }
};

// Função para iniciar a busca a cada 5 segundos
const iniciarBuscaIntervalo = (id_rota) => {
    // Se já existir um intervalo em execução, limpe-o
    if (intervalId) {
        clearInterval(intervalId);
    }

    // Inicia um novo intervalo de 5 segundos
    intervalId = setInterval(() => {
        // Chama a função para consultar as coordenadas de 'localAtual'
        consultarLocalAtualPorId(id_rota, coordenadas => {
            if (coordenadas && coordenadas.length > 0) {
                // As coordenadas são exibidas diretamente no console.log dentro da função
            }
        });
    }, 5000); // Intervalo de 5 segundos
};

// Chama a função para listar as rotas
listarRotas(rotas => {
    let optionRotas = "<option value=''></option>";
    rotas.forEach(element => {
        optionRotas += `<option value="${element.id}">${element.nome}</option>`;
    });

    document.getElementById("nome-rotas").innerHTML = optionRotas;
});

let select_nome_rotas = document.getElementById("nome-rotas");
select_nome_rotas.onchange = (event) => {
    let id_rota = event.target.value;

    // Limpa a rota e as coordenadas exibidas anteriormente
    if (currentPolyline) {
        mymap.removeLayer(currentPolyline); // Remove a polilinha anterior
        currentPolyline = null; // Limpa a variável que mantém a polilinha
    }

    console.clear(); // Limpa o console para não acumular logs

    // Consulta as rotas por ID e exibe as coordenadas de 'localAtual' no console
    consultarRotasPorIs(id_rota, dadosRota => {
        if (dadosRota) {
            addPontos(dadosRota.path, dadosRota.nome, dadosRota.cor); // Exibe as rotas no mapa
        }
    });

    // Chama a função para buscar as coordenadas de 'localAtual' com base no objectId selecionado
    consultarLocalAtualPorId(id_rota, coordenadas => {
        if (coordenadas && coordenadas.length > 0) {
            // As coordenadas são exibidas diretamente no console.log dentro da função
        }
    });
    

    // Inicia a busca a cada 5 segundos para o objectId selecionado
    iniciarBuscaIntervalo(id_rota);
};
