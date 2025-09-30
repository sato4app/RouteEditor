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
    let pointCount = 0;      // ポイントGPS
    let waypointCount = 0;   // ルート中間点
    let spotCount = 0;       // スポット
    let lineCount = 0;       // ルート（LineString）
    let polygonCount = 0;    // ポリゴン

    if (geoJsonData && geoJsonData.features) {
        geoJsonData.features.forEach(feature => {
            const featureType = feature.properties && feature.properties.type;
            const geometryType = feature.geometry.type;

            // Pointの場合はプロパティのtypeで分類
            if (geometryType === 'Point') {
                if (featureType === 'ポイントGPS') {
                    pointCount++;
                } else if (featureType === 'route_waypoint') {
                    waypointCount++;
                } else if (featureType === 'spot') {
                    spotCount++;
                } else {
                    // typeが指定されていない場合はポイントとしてカウント
                    pointCount++;
                }
            }
            // LineStringはルートとしてカウント
            else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
                lineCount++;
            }
            // Polygonはスポットまたはポリゴンとしてカウント
            else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
                polygonCount++;
            }
        });
    }

    document.getElementById('fileCount').value = geoJsonData ? '1' : '0';
    document.getElementById('pointCount').value = pointCount;
    // ルートカウントは中間点とLineStringの合計
    document.getElementById('routeCount').value = waypointCount + lineCount;
    // スポットカウントはスポットポイントとポリゴンの合計
    document.getElementById('spotCount').value = spotCount + polygonCount;
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
                        // フィーチャータイプに基づいてスタイルを選択
                        const featureType = feature.properties && feature.properties.type;
                        const style = DEFAULTS.FEATURE_STYLES[featureType] || DEFAULTS.POINT_STYLE;

                        // デバッグ: 適用タイプと色/不透明度を確認
                        try {
                            console.debug('[pointToLayer]', {
                                featureType,
                                shape: style.shape || 'circle',
                                fillColor: style.fillColor,
                                fillOpacity: style.fillOpacity,
                                stroke: style.stroke,
                                weight: style.weight
                            });
                        } catch (e) {}

                        // 形状に基づいてマーカーを作成
                        if (style.shape === 'diamond') {
                            // 菱形（ダイヤモンド型）マーカー
                            return L.marker(latlng, {
                                icon: L.divIcon({
                                    className: 'diamond-marker',
                                    html: `<div style="width: ${style.radius * 2}px; height: ${style.radius * 2}px; background-color: ${style.fillColor}; transform: rotate(45deg); opacity: ${style.fillOpacity};"></div>`,
                                    iconSize: [style.radius * 2, style.radius * 2],
                                    iconAnchor: [style.radius, style.radius]
                                })
                            });
                        } else if (style.shape === 'square') {
                            // 正方形マーカー
                            return L.marker(latlng, {
                                icon: L.divIcon({
                                    className: 'square-marker',
                                    html: `<div style="width: ${style.radius}px; height: ${style.radius}px; background-color: ${style.fillColor}; opacity: ${style.fillOpacity};"></div>`,
                                    iconSize: [style.radius, style.radius],
                                    iconAnchor: [style.radius / 2, style.radius / 2]
                                })
                            });
                        } else {
                            // デフォルトの円形マーカー
                            return L.circleMarker(latlng, style);
                        }
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