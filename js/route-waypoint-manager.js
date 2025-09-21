// ウェイポイント管理機能を専門に扱うモジュール
export class RouteWaypointManager {
    constructor(map, imageOverlay, gpsData) {
        this.map = map;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.waypointMarkers = [];
    }

    // ウェイポイント配列を取得する統一メソッド
    getWaypoints(routeData) {
        return routeData.wayPoint || routeData.wayPoints || routeData.points || [];
    }

    // 地図にウェイポイントを追加
    addWaypointToRoute(latlng, routeData, onUpdate) {
        // GPSポイントとの重複のみチェック（他のルートとの重複は許可）
        if (this.isNearGPSPoint(latlng)) {
            return;
        }

        // 地図座標を画像座標に変換
        const imageCoords = this.convertMapToImageCoordinates(latlng.lat, latlng.lng);
        if (!imageCoords) {
            throw new Error('画像座標への変換に失敗しました。');
        }

        const wayPoints = this.getWaypoints(routeData);
        const nextIndex = this.getNextWaypointIndex(routeData);
        
        const newWaypoint = {
            type: "waypoint",
            index: nextIndex,
            imageX: Math.round(imageCoords.x),
            imageY: Math.round(imageCoords.y)
        };

        // ルートデータのウェイポイント配列に追加
        if (wayPoints && Array.isArray(wayPoints)) {
            wayPoints.push(newWaypoint);
        } else {
            routeData.wayPoint = [newWaypoint];
        }

        onUpdate(routeData);
    }

    // ウェイポイントを削除
    deleteWaypointFromRoute(latlng, routeData, onUpdate) {
        const wayPoints = this.getWaypoints(routeData);
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }

        const closestIndex = this.findClosestWaypointIndex(latlng, wayPoints);
        
        if (closestIndex !== -1) {
            wayPoints.splice(closestIndex, 1);
            onUpdate(routeData);
        } else {
            // 削除対象のウェイポイントが見つからない（無視）
        }
    }

    // 指定されたウェイポイントを直接削除
    deleteSpecificWaypoint(targetPoint, routeData, onUpdate) {
        const wayPoints = this.getWaypoints(routeData);
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }

        // 対象のウェイポイントを検索
        const targetIndex = wayPoints.findIndex(point => 
            point.imageX === targetPoint.imageX && point.imageY === targetPoint.imageY
        );

        if (targetIndex !== -1) {
            wayPoints.splice(targetIndex, 1);
            onUpdate(routeData);
        }
    }

    // 最も近いウェイポイントのインデックスを取得
    findClosestWaypointIndex(latlng, wayPoints) {
        let closestIndex = -1;
        let minDistance = Infinity;
        const threshold = 100; // ピクセル単位の閾値

        wayPoints.forEach((point, index) => {
            const mapPosition = this.convertImageToMapCoordinates(point.imageX, point.imageY);
            if (mapPosition) {
                const mapDistance = latlng.distanceTo(mapPosition);
                const markerPixel = this.map.latLngToContainerPoint(mapPosition);
                const clickPixel = this.map.latLngToContainerPoint(latlng);
                const pixelDistance = markerPixel.distanceTo(clickPixel);
                
                if ((mapDistance < 50 || pixelDistance < threshold) && (mapDistance < minDistance || pixelDistance < minDistance)) {
                    minDistance = Math.min(mapDistance, pixelDistance);
                    closestIndex = index;
                }
            }
        });

        return closestIndex;
    }

    // 次のウェイポイントindexを取得
    getNextWaypointIndex(routeData) {
        const wayPoints = this.getWaypoints(routeData);
        
        if (wayPoints.length === 0) {
            return 1; // 最初のウェイポイントはindex 1から開始
        }
        
        // 既存のindex値の最大値を取得
        const existingIndexes = wayPoints
            .map(point => point.index)
            .filter(index => typeof index === 'number' && !isNaN(index));
        
        if (existingIndexes.length === 0) {
            return 1; // index が設定されていないウェイポイントがある場合
        }
        
        return Math.max(...existingIndexes) + 1;
    }

    // ウェイポイントデータを初期化（type、indexが設定されていない場合）
    initializeWaypointData(routeData) {
        const wayPoints = this.getWaypoints(routeData);
        
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }
        
        wayPoints.forEach((point, arrayIndex) => {
            // type が設定されていない場合は "waypoint" を設定
            if (!point.type) {
                point.type = "waypoint";
            }
            
            // index が設定されていない場合は配列のインデックス + 1 を設定
            if (point.index === undefined || point.index === null) {
                point.index = arrayIndex + 1;
            }
            
            // imageX, imageY を整数化（既存データの場合）
            if (point.imageX !== undefined) {
                point.imageX = Math.round(point.imageX);
            }
            if (point.imageY !== undefined) {
                point.imageY = Math.round(point.imageY);
            }
        });
    }

    // GPSポイントに近いかどうかをチェック
    isNearGPSPoint(latlng) {
        return this.checkGPSPointCollision(latlng, 5);
    }

    // GPS点との衝突チェック
    checkGPSPointCollision(latlng, thresholdMeters) {
        if (this.gpsData && this.gpsData.gpsPoints) {
            for (const gpsPoint of this.gpsData.gpsPoints) {
                const distance = latlng.distanceTo([gpsPoint.latitude, gpsPoint.longitude]);
                if (distance < thresholdMeters) {
                    return true;
                }
            }
        }
        return false;
    }

    // 地図座標を画像座標に変換
    convertMapToImageCoordinates(lat, lng) {
        if (!this.imageOverlay || !this.imageOverlay.imageOverlay) {
            return null;
        }

        const overlay = this.imageOverlay.imageOverlay;
        const bounds = overlay.getBounds();
        const imageElement = overlay.getElement();

        if (!imageElement) {
            return null;
        }

        // 画像の元のサイズを取得
        const imageNaturalWidth = imageElement.naturalWidth;
        const imageNaturalHeight = imageElement.naturalHeight;

        if (imageNaturalWidth === 0 || imageNaturalHeight === 0) {
            return null;
        }

        // 地図座標から画像内の相対位置を計算
        const relativeX = (lng - bounds.getWest()) / (bounds.getEast() - bounds.getWest());
        const relativeY = (bounds.getNorth() - lat) / (bounds.getNorth() - bounds.getSouth());

        // 画像座標に変換
        const imageX = relativeX * imageNaturalWidth;
        const imageY = relativeY * imageNaturalHeight;

        return { x: imageX, y: imageY };
    }

    // 画像座標から地図座標への変換
    convertImageToMapCoordinates(imageX, imageY) {
        if (!this.imageOverlay || !this.imageOverlay.imageOverlay) {
            return null;
        }
        
        const overlay = this.imageOverlay.imageOverlay;
        const bounds = overlay.getBounds();
        const imageElement = overlay.getElement();
        
        if (!imageElement) {
            return null;
        }
        
        // 画像の元のサイズを取得
        const imageNaturalWidth = imageElement.naturalWidth;
        const imageNaturalHeight = imageElement.naturalHeight;
        
        if (imageNaturalWidth === 0 || imageNaturalHeight === 0) {
            return null;
        }
        
        // 画像内の相対位置を計算（元画像サイズベース）
        const relativeX = imageX / imageNaturalWidth;
        const relativeY = imageY / imageNaturalHeight;
        
        // 地図座標に変換
        const lat = bounds.getNorth() - (bounds.getNorth() - bounds.getSouth()) * relativeY;
        const lng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * relativeX;
        
        return [lat, lng];
    }

    // ウェイポイントのドラッグ終了時の処理
    onWaypointDragEnd(e, waypointData, routeData, onUpdate) {
        const newPosition = e.target.getLatLng();
        
        // 新しい地図座標を画像座標に変換
        const imageCoords = this.convertMapToImageCoordinates(newPosition.lat, newPosition.lng);
        if (!imageCoords) {
            // 変換に失敗した場合は元の位置に戻す
            const oldPosition = this.convertImageToMapCoordinates(waypointData.imageX, waypointData.imageY);
            if (oldPosition) {
                e.target.setLatLng(oldPosition);
            }
            throw new Error('画像座標への変換に失敗しました。');
        }

        // ウェイポイントデータを更新（四捨五入して整数化）
        waypointData.imageX = Math.round(imageCoords.x);
        waypointData.imageY = Math.round(imageCoords.y);

        onUpdate(routeData);
    }

    // マーカーをクリア
    clearWaypointMarkers() {
        this.waypointMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.waypointMarkers = [];
    }

    // ウェイポイントマーカーを地図に追加
    addRouteToMap(routeData, isSelected, onWaypointDragEnd, onSpecificWaypointDelete, onDynamicUpdate = null) {
        const wayPoints = this.getWaypoints(routeData);
        
        if (wayPoints && Array.isArray(wayPoints)) {
            wayPoints.forEach((point, index) => {
                const imageX = point.imageX;
                const imageY = point.imageY;
                
                if (imageX !== undefined && imageY !== undefined) {
                    // 画像座標から地図座標への変換
                    const mapPosition = this.convertImageToMapCoordinates(imageX, imageY);
                    
                    if (mapPosition) {
                        // 選択状態に応じてアイコンサイズを決定
                        const iconClass = isSelected ? 'waypoint-marker-icon' : 'waypoint-marker-icon waypoint-marker-icon-small';
                        const iconSize = isSelected ? [12, 12] : [8, 8];
                        const iconAnchor = isSelected ? [6, 6] : [4, 4];
                        
                        // オレンジ菱形マーカーを作成
                        const diamondIcon = L.divIcon({
                            className: iconClass,
                            html: '<div class="diamond"></div>',
                            iconSize: iconSize,
                            iconAnchor: iconAnchor
                        });
                        
                        const marker = L.marker(mapPosition, {
                            icon: diamondIcon,
                            draggable: false, // 初期状態ではドラッグ無効
                            zIndexOffset: isSelected ? 1000 : 500,
                            pane: 'waypointMarkers'
                        }).addTo(this.map);

                        // マーカーにウェイポイントデータを保存
                        marker.waypointData = point;
                        marker.routeData = routeData;
                        
                        // 動的更新コールバックを設定
                        if (onDynamicUpdate) {
                            marker.onDynamicUpdate = onDynamicUpdate;
                        }
                        
                        // 選択されたルートのみドラッグ終了時の処理を追加
                        if (isSelected) {
                            // ドラッグ終了時の処理を追加
                            marker.on('dragend', (e) => {
                                onWaypointDragEnd(e, point, routeData);
                            });
                        }

                        // 削除モード用のクリックイベントを追加
                        marker.on('click', (e) => {
                            if (isSelected) {
                                onSpecificWaypointDelete(point, routeData);
                                // 地図クリックイベントの伝播を停止
                                L.DomEvent.stopPropagation(e);
                            }
                        });
                        
                        this.waypointMarkers.push(marker);
                    }
                }
            });
        }
    }

    // マーカーのドラッグ可能状態を更新
    updateMarkerDraggableState(selectedRoute, selectedActionButton, onDragEndCallback = null) {
        this.waypointMarkers.forEach(marker => {
            if (marker.routeData === selectedRoute && selectedActionButton === 'move') {
                // ドラッグを有効化
                if (marker.dragging) {
                    marker.dragging.enable();
                }
                
                // ドラッグイベントを追加（重複追加を防ぐため一旦削除）
                marker.off('drag dragend');
                
                // ドラッグ中の動的更新
                marker.on('drag', (e) => {
                    if (marker.onDynamicUpdate) {
                        marker.onDynamicUpdate(e, marker.waypointData, marker.routeData);
                    }
                });
                
                // ドラッグ終了時の確定処理
                marker.on('dragend', (e) => {
                    this.onWaypointDragEnd(e, marker.waypointData, marker.routeData, (routeData) => {
                        if (onDragEndCallback) {
                            onDragEndCallback(routeData);
                        }
                    });
                });
            } else {
                // ドラッグを無効化
                if (marker.dragging) {
                    marker.dragging.disable();
                }
                marker.off('drag dragend');
            }
        });
    }
}