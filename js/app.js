import { DEFAULTS, MODES } from './constants.js';

// 地図の初期化
const map = L.map('map').setView(DEFAULTS.MAP_CENTER, DEFAULTS.MAP_ZOOM);

// 地理院地図タイルの追加
L.tileLayer(DEFAULTS.GSI_TILE_URL, {
    attribution: DEFAULTS.GSI_ATTRIBUTION,
    maxZoom: DEFAULTS.MAP_MAX_ZOOM
}).addTo(map);

// スケールコントロールを右下に追加
L.control.scale({
    position: 'bottomright',
    metric: true,
    imperial: false
}).addTo(map);

// カスタムズームコントロールを右下に追加
const CustomZoomControl = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

        // ズームインボタン
        const zoomInBtn = L.DomUtil.create('a', 'zoom-in-btn', container);
        zoomInBtn.innerHTML = '＋';
        zoomInBtn.href = '#';
        zoomInBtn.title = 'ズームイン';

        // ズームアウトボタン
        const zoomOutBtn = L.DomUtil.create('a', 'zoom-out-btn', container);
        zoomOutBtn.innerHTML = '－';
        zoomOutBtn.href = '#';
        zoomOutBtn.title = 'ズームアウト';

        // イベントハンドラー
        L.DomEvent.on(zoomInBtn, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            map.zoomIn();
        });

        L.DomEvent.on(zoomOutBtn, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            map.zoomOut();
        });

        return container;
    },

    onRemove: function(map) {
        // クリーンアップは特に必要なし
    }
});

// デフォルトのズームコントロールを削除し、カスタムズームコントロールを追加
map.removeControl(map.zoomControl);
new CustomZoomControl({ position: 'bottomright' }).addTo(map);

// GeoJSONレイヤーグループ
let geoJsonLayer = L.layerGroup().addTo(map);
let loadedData = null;

// 統計情報の更新
function updateStats(geoJsonData) {
    let pointCount = 0;
    let lineCount = 0;
    let polygonCount = 0;

    if (geoJsonData && geoJsonData.features) {
        geoJsonData.features.forEach(feature => {
            switch (feature.geometry.type) {
                case 'Point':
                    pointCount++;
                    break;
                case 'LineString':
                case 'MultiLineString':
                    lineCount++;
                    break;
                case 'Polygon':
                case 'MultiPolygon':
                    polygonCount++;
                    break;
            }
        });
    }

    document.getElementById('fileCount').value = geoJsonData ? '1' : '0';
    document.getElementById('pointCount').value = Math.min(pointCount, 9999);
    document.getElementById('routeCount').value = Math.min(lineCount, 9999);
    document.getElementById('spotCount').value = Math.min(polygonCount, 9999);
}

// ファイル読み込み処理
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const geoJsonData = JSON.parse(e.target.result);

                // 既存のレイヤーをクリア
                geoJsonLayer.clearLayers();

                // GeoJSONデータを地図に追加
                L.geoJSON(geoJsonData, {
                    style: function(feature) {
                        return DEFAULTS.LINE_STYLE;
                    },
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, DEFAULTS.POINT_STYLE);
                    },
                    onEachFeature: function(feature, layer) {
                        if (feature.properties && feature.properties.name) {
                            layer.bindPopup(feature.properties.name);
                        }
                    }
                }).addTo(geoJsonLayer);

                loadedData = geoJsonData;
                updateStats(geoJsonData);

                // データの範囲に地図をフィット
                const group = new L.featureGroup();
                geoJsonLayer.eachLayer(layer => group.addLayer(layer));
                if (group.getBounds().isValid()) {
                    map.fitBounds(group.getBounds(), {padding: [10, 10]});
                }

                alert('GeoJSONファイルを読み込みました');
            } catch (error) {
                alert('ファイルの読み込みに失敗しました: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
});

// ファイル出力処理
document.getElementById('exportBtn').addEventListener('click', function() {
    if (!loadedData) {
        alert('出力するデータがありません。先にGeoJSONファイルを読み込んでください。');
        return;
    }

    const dataStr = JSON.stringify(loadedData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = DEFAULTS.EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('GeoJSONファイルを出力しました');
});

// モード切り替え処理
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        // 選択状態の表示更新
        document.querySelectorAll('.control-section label span').forEach(span => {
            span.classList.remove('selected');
        });

        if (this.checked) {
            this.nextElementSibling.classList.add('selected');
        }
    });
});

// 初期統計表示
updateStats(null);