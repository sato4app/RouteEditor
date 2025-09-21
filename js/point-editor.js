// ポイント編集機能を管理するモジュール
import { Validators } from './validators.js';

export class PointEditor {
    constructor(map, gpsData) {
        this.map = map;
        this.gpsData = gpsData;
        this.selectedAction = null;
        this.tempCounter = 1; // 仮ナンバリング用カウンター
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // ポイント操作ボタンのイベントハンドラー設定
        const addPointBtn = document.getElementById('addPointBtn');
        const movePointBtn = document.getElementById('movePointBtn');
        const deletePointBtn = document.getElementById('deletePointBtn');

        if (addPointBtn) {
            addPointBtn.addEventListener('click', () => {
                this.toggleActionButton('add', addPointBtn);
            });
        }

        if (movePointBtn) {
            movePointBtn.addEventListener('click', () => {
                this.toggleActionButton('move', movePointBtn);
            });
        }

        if (deletePointBtn) {
            deletePointBtn.addEventListener('click', () => {
                this.onDeleteButtonClick(deletePointBtn);
            });
        }

        // 地図クリックイベント
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });

        // フィールド更新イベント
        const pointIdField = document.getElementById('pointIdField');
        const locationField = document.getElementById('locationField');
        
        if (pointIdField) {
            pointIdField.addEventListener('input', () => {
                this.updateSelectedPointData();
            });
            
            // ID名フィールドでEnter/Tabキーが押されたら場所フィールドにフォーカス移動
            pointIdField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    if (locationField) {
                        locationField.focus();
                    }
                }
            });
            
            // ID名フィールドのblurイベントで仮ナンバリング処理とX-nn形式チェック・変換
            pointIdField.addEventListener('blur', () => {
                const currentValue = pointIdField.value.trim();
                
                if (this.selectedPoint && currentValue === '') {
                    // 空の場合は仮ナンバリング
                    const tempId = `仮${this.tempCounter.toString().padStart(2, '0')}`;
                    pointIdField.value = tempId;
                    this.selectedPoint.pointId = tempId;
                    this.tempCounter++;
                    
                    // GPSDataの該当するポイントデータも更新
                    if (this.gpsData && this.gpsData.gpsMarkers) {
                        const markerItem = this.gpsData.gpsMarkers.find(item => item.data === this.selectedPoint);
                        if (markerItem) {
                            markerItem.data.pointId = tempId;
                            
                            // ポップアップも更新
                            const popupContent = `<div style="padding:1px 1px;text-align:center;min-width:18px;line-height:1;">${tempId}</div>`;
                            markerItem.marker.bindPopup(popupContent, {
                                offset: [0, -12],
                                closeButton: false,
                                autoPan: false,
                                className: 'gps-popup-minimal'
                            });
                        }
                    }
                } else if (currentValue !== '') {
                    // X-nn形式のチェック・変換
                    const convertedValue = Validators.formatPointId(currentValue);
                    if (convertedValue !== currentValue) {
                        pointIdField.value = convertedValue;
                        if (this.selectedPoint) {
                            this.selectedPoint.pointId = convertedValue;
                            
                            // GPSDataの該当するポイントデータも更新
                            if (this.gpsData && this.gpsData.gpsMarkers) {
                                const markerItem = this.gpsData.gpsMarkers.find(item => item.data === this.selectedPoint);
                                if (markerItem) {
                                    markerItem.data.pointId = convertedValue;
                                    
                                    // ポップアップも更新
                                    const popupContent = `<div style="padding:1px 1px;text-align:center;min-width:18px;line-height:1;">${convertedValue}</div>`;
                                    markerItem.marker.bindPopup(popupContent, {
                                        offset: [0, -12],
                                        closeButton: false,
                                        autoPan: false,
                                        className: 'gps-popup-minimal'
                                    });
                                }
                            }
                        }
                    }
                }
            });
        }
        
        if (locationField) {
            locationField.addEventListener('input', () => {
                this.updateSelectedPointData();
            });
        }
    }

    toggleActionButton(action, buttonElement) {
        // 全てのボタンから選択状態を削除
        const allButtons = document.querySelectorAll('.point-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));

        // クリックしたボタンが現在選択されているボタンと同じ場合は未選択状態にする
        if (this.selectedAction === action) {
            this.selectedAction = null;
            this.updateMapCursor();
        } else {
            // 新しいボタンを選択状態にする
            this.selectedAction = action;
            buttonElement.classList.add('selected');
            this.updateMapCursor();
        }
    }

    updateMapCursor() {
        const mapContainer = this.map.getContainer();
        
        switch (this.selectedAction) {
            case 'add':
                mapContainer.style.cursor = 'crosshair';
                break;
            case 'move':
                mapContainer.style.cursor = 'move';
                this.updatePointsDraggable(true);
                break;
            case 'delete':
                mapContainer.style.cursor = 'pointer';
                this.updatePointsDraggable(false);
                break;
            default:
                mapContainer.style.cursor = '';
                this.updatePointsDraggable(false);
                break;
        }
    }

    onMapClick(e) {
        if (!this.selectedAction) {
            return;
        }

        switch (this.selectedAction) {
            case 'add':
                this.addPoint(e.latlng);
                break;
            // move と delete は個別のマーカーイベントで処理
        }
    }

    addPoint(latlng) {
        // 新しいポイントデータを作成（ID名は仮ナンバリングを設定）
        const tempId = `仮${this.tempCounter.toString().padStart(2, '0')}`;
        this.tempCounter++;
        
        const pointData = {
            pointId: tempId,
            lat: latlng.lat,
            lng: latlng.lng,
            location: '',
            elevation: null
        };

        // GPSDataクラスを使用してマーカーを作成
        if (this.gpsData) {
            // 既存のマーカーをクリアせずに、新しいポイントだけを追加
            const currentMarkers = [...this.gpsData.gpsMarkers];
            const newGpsData = [pointData];
            
            // addGPSMarkersToMapは既存をクリアするので、手動でマーカーを作成
            const triangleIcon = L.divIcon({
                className: 'gps-triangle-marker',
                html: `<div style="width: 0; height: 0; border-left: 6.5px solid transparent; border-right: 6.5px solid transparent; border-top: 14px solid #32cd32; position: relative;"></div>`,
                iconSize: [13, 14],
                iconAnchor: [6.5, 14]
            });

            const marker = L.marker([pointData.lat, pointData.lng], {
                icon: triangleIcon
            }).addTo(this.map);

            // ポップアップを設定
            let popupContent = `<div style="padding:1px 1px;text-align:center;min-width:18px;line-height:1;">${pointData.pointId}</div>`;
            marker.bindPopup(popupContent, {
                offset: [0, -12],
                closeButton: false,
                autoPan: false,
                className: 'gps-popup-minimal'
            });

            // GPSDataの配列に追加
            this.gpsData.gpsMarkers.push({
                marker: marker,
                data: pointData
            });
            
            // マーカーにイベントリスナーを追加
            this.setupMarkerEvents(marker, pointData);
            
            // ポイントを選択状態にする
            this.selectPoint(pointData, marker);
        }

        // UI更新
        this.updatePointCountField();

        // ID名フィールドのテキストを全選択
        const pointIdField = document.getElementById('pointIdField');
        if (pointIdField) {
            setTimeout(() => {
                pointIdField.focus();
                pointIdField.select();
            }, 100);
        }

        // 追加モードを解除（選択したポイント情報はクリアしない）
        const allButtons = document.querySelectorAll('.point-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        this.selectedAction = null;
        this.updateMapCursor();
    }

    setupMarkerEvents(marker, pointData) {
        // マーカークリックイベント
        marker.off('click').on('click', (e) => {
            e.originalEvent.stopPropagation();
            this.onMarkerClick(pointData, marker);
        });

        // マウスホバーイベント（移動モード時のカーソル変更）
        marker.off('mouseover').on('mouseover', () => {
            if (this.selectedAction === 'move') {
                marker.getElement().style.cursor = 'pointer';
            }
        });

        marker.off('mouseout').on('mouseout', () => {
            if (this.selectedAction === 'move') {
                marker.getElement().style.cursor = 'pointer';
            } else {
                marker.getElement().style.cursor = 'pointer';
            }
        });

        // ドラッグ開始イベント
        marker.off('dragstart').on('dragstart', (e) => {
            if (this.selectedAction === 'move') {
                // マウスダウンでポイントのID名や場所を表示し、ポップアップも表示
                marker.openPopup();
                this.selectPoint(pointData, marker);
            }
        });

        // ドラッグ中イベント（座標情報をリアルタイム更新）
        marker.off('drag').on('drag', (e) => {
            if (this.selectedAction === 'move') {
                const newLatLng = e.target.getLatLng();
                pointData.lat = newLatLng.lat;
                pointData.lng = newLatLng.lng;
                this.updatePointInfo(pointData);
            }
        });

        // ドラッグ終了イベント
        marker.off('dragend').on('dragend', (e) => {
            const newLatLng = e.target.getLatLng();
            pointData.lat = newLatLng.lat;
            pointData.lng = newLatLng.lng;
            this.updatePointInfo(pointData);
            
            // 移動モードの場合は移動ボタンの選択を解除
            if (this.selectedAction === 'move') {
                this.clearSelection();
            }
        });

        // マーカーにポイントデータを関連付け
        marker.pointData = pointData;
    }

    onMarkerClick(pointData, marker) {
        if (this.selectedAction === 'delete') {
            this.deletePoint(pointData, marker);
        } else {
            // ポップアップを表示
            marker.openPopup();
            this.selectPoint(pointData, marker);
            
            // 移動モードの場合はGPS情報も表示
            if (this.selectedAction === 'move') {
                this.updatePointInfo(pointData);
            }
        }
    }

    selectPoint(pointData, marker = null) {
        this.selectedPoint = pointData;
        this.selectedMarker = marker;
        this.updatePointInfo(pointData);
    }

    deletePoint(pointData, marker) {
        // GPSDataから該当するマーカーを見つけて削除
        if (this.gpsData) {
            const markerIndex = this.gpsData.gpsMarkers.findIndex(
                item => item.marker === marker || 
                (item.data.pointId === pointData.pointId && 
                 item.data.lat === pointData.lat && 
                 item.data.lng === pointData.lng)
            );
            
            if (markerIndex !== -1) {
                // マーカーを地図から削除
                this.map.removeLayer(this.gpsData.gpsMarkers[markerIndex].marker);
                
                // GPSDataの配列から削除
                this.gpsData.gpsMarkers.splice(markerIndex, 1);
            }
        }
        
        // UI更新
        this.updatePointCountField();
        
        // 選択中のポイントの場合はクリア
        if (this.selectedPoint === pointData) {
            this.clearPointInfo();
        }
        
        // 削除モードを解除
        this.clearSelection();
    }

    updatePointsDraggable(draggable) {
        // GPSDataのマーカーを対象とする
        if (this.gpsData && this.gpsData.gpsMarkers) {
            this.gpsData.gpsMarkers.forEach(item => {
                const marker = item.marker;
                if (draggable) {
                    marker.dragging.enable();
                    if (marker.getElement()) {
                        marker.getElement().style.cursor = 'move';
                    }
                } else {
                    marker.dragging.disable();
                    if (marker.getElement()) {
                        marker.getElement().style.cursor = 'pointer';
                    }
                }
            });
        }
    }

    updateSelectedPointData() {
        if (!this.selectedPoint) return;

        const pointIdField = document.getElementById('pointIdField');
        const locationField = document.getElementById('locationField');

        if (pointIdField) {
            this.selectedPoint.pointId = pointIdField.value;
        }
        
        if (locationField) {
            this.selectedPoint.location = locationField.value;
        }
    }

    updatePointInfo(pointData) {
        const pointIdField = document.getElementById('pointIdField');
        const latDecimalField = document.getElementById('latDecimalField');
        const lngDecimalField = document.getElementById('lngDecimalField');
        const dmsField = document.getElementById('dmsField');
        const elevationField = document.getElementById('elevationField');
        const gpsElevationField = document.getElementById('gpsElevationField');
        const locationField = document.getElementById('locationField');

        if (pointIdField) pointIdField.value = pointData.pointId || '';
        if (latDecimalField) latDecimalField.value = pointData.lat ? pointData.lat.toFixed(8) : '';
        if (lngDecimalField) lngDecimalField.value = pointData.lng ? pointData.lng.toFixed(8) : '';
        if (dmsField) dmsField.value = this.convertToDMS(pointData.lat, pointData.lng);
        if (elevationField) elevationField.value = pointData.elevation || '';
        if (locationField) locationField.value = pointData.location || '';

        // GPS標高を取得・表示
        if (pointData.lat && pointData.lng && gpsElevationField) {
            // 取得中表示
            gpsElevationField.value = '';
            this.fetchGpsElevation(pointData.lat, pointData.lng, gpsElevationField);
        } else if (gpsElevationField) {
            gpsElevationField.value = '';
        }
    }

    clearPointInfo() {
        const fields = ['pointIdField', 'latDecimalField', 'lngDecimalField', 'dmsField', 'elevationField', 'gpsElevationField', 'locationField'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
        this.selectedPoint = null;
        this.selectedMarker = null;
    }

    updatePointCountField() {
        const pointCountField = document.getElementById('pointCountField');
        if (pointCountField && this.gpsData && this.gpsData.gpsMarkers) {
            pointCountField.value = this.gpsData.gpsMarkers.length.toString();
        }
    }

    onDeleteButtonClick(deleteButton) {
        // すでにポイントが選択されている場合は即座に削除
        if (this.selectedPoint && this.selectedMarker) {
            this.deletePoint(this.selectedPoint, this.selectedMarker);
        } else {
            // ポイントが選択されていない場合は削除モードに切り替え
            this.toggleActionButton('delete', deleteButton);
        }
    }

    clearSelection() {
        const allButtons = document.querySelectorAll('.point-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        this.selectedAction = null;
        this.updateMapCursor();
    }

    convertToDMS(lat, lng) {
        if (!lat || !lng) return '';
        
        const convertCoord = (coord, isLat) => {
            const abs = Math.abs(coord);
            const degrees = Math.floor(abs);
            const minutes = Math.floor((abs - degrees) * 60);
            const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60 * 100) / 100;
            
            const direction = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
            return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
        };
        
        return `${convertCoord(lat, true)} / ${convertCoord(lng, false)}`;
    }

    // 既存のGPSデータからポイントを読み込む
    loadExistingPoints() {
        if (!this.gpsData || !this.gpsData.gpsMarkers) return;

        // 既存のマーカーにイベントリスナーを追加
        this.gpsData.gpsMarkers.forEach(item => {
            this.setupMarkerEvents(item.marker, item.data);
        });

        this.updatePointCountField();
    }

    // 既存のマーカーにも新しいイベントハンドラーを適用するメソッド
    refreshExistingMarkerEvents() {
        if (!this.gpsData || !this.gpsData.gpsMarkers) return;

        this.gpsData.gpsMarkers.forEach(item => {
            this.setupMarkerEvents(item.marker, item.data);
        });
    }

    // 地理院地図のGPS値から標高を取得する
    async fetchGpsElevation(lat, lng, fieldElement) {
        if (!fieldElement) return;
        
        try {
            // 地理院地図の標高API
            const response = await fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`);
            const data = await response.json();
            
            if (data && data.elevation !== undefined && data.elevation !== null) {
                const elevation = Math.round(data.elevation); // 四捨五入して整数部のみ
                fieldElement.value = elevation.toString(); // 数値のみを表示
            } else {
                fieldElement.value = '';
            }
        } catch (error) {
            fieldElement.value = '';
            // 標高取得エラー（無視）
        }
    }

}