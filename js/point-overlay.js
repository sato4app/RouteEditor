// ポイントオーバーレイ機能を管理するモジュール
export class PointOverlay {
    constructor(map, imageOverlay = null, gpsData = null) {
        this.map = map;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.pointData = [];
        this.pointMarkers = [];
        this.originalPointData = []; // 元の画像座標を保持
        this.setupEventHandlers();
        
        // 画像更新時のコールバックを登録
        if (this.imageOverlay) {
            this.imageOverlay.addImageUpdateCallback(() => {
                this.updatePointPositions();
            });
        }
    }


    setupEventHandlers() {
        const loadPointJsonBtn = document.getElementById('loadPointJsonBtn');
        const pointJsonInput = document.getElementById('pointJsonInput');
        const matchPointsBtn = document.getElementById('matchPointsBtn');

        if (loadPointJsonBtn && pointJsonInput) {
            loadPointJsonBtn.addEventListener('click', () => {
                pointJsonInput.click();
            });

            pointJsonInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadPointJSON(file).catch(error => {
                        this.showErrorMessage('ポイントJSONファイルの読み込みに失敗しました', error.message);
                    });
                }
            });
        }

        if (matchPointsBtn) {
            matchPointsBtn.addEventListener('click', () => {
                // ポイントマッチングを実行
                this.matchPointsWithGPS();
                
                // 画像の重ね合わせ（ジオリファレンス）を実行
                this.autoAdjustImageToGPS();
            });
        }
    }

    loadPointJSON(file) {
        return new Promise((resolve, reject) => {
            // ファイル形式チェック
            if (!file.name.toLowerCase().endsWith('.json')) {
                reject(new Error('JSON形式のファイルのみ受け付けます'));
                return;
            }

            // 画像が読み込まれているかチェック
            if (!this.imageOverlay || !this.imageOverlay.getCurrentImageInfo().isLoaded) {
                reject(new Error('ポイントJSONを読み込む前に画像を読み込んでください'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const pointData = JSON.parse(e.target.result);
                    
                    // imageReferenceの一致チェック
                    if (pointData.imageReference) {
                        const currentImageInfo = this.imageOverlay.getCurrentImageInfo();
                        if (pointData.imageReference !== currentImageInfo.fileName) {
                            this.showWarningMessage(
                                '画像参照の不一致',
                                `JSONファイル内の画像参照: "${pointData.imageReference}"\n現在読み込まれている画像: "${currentImageInfo.fileName}"\n\n画像が一致しない可能性があります。`
                            );
                        }
                    }
                    
                    this.addPointsToMap(pointData);
                    resolve(pointData);
                } catch (error) {
                    reject(new Error('JSONファイルの解析に失敗しました: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    addPointsToMap(pointData) {
        // 既存のポイントマーカーを削除
        this.clearPointMarkers();
        
        // 元の画像座標データを保存
        this.originalPointData = [];
        
        // ポイントデータの処理と地図への追加
        if (pointData.points && Array.isArray(pointData.points)) {
            pointData.points.forEach((point, index) => {
                if (point.imageX !== undefined && point.imageY !== undefined) {
                    // 元の画像座標を保存
                    this.originalPointData.push({
                        imageX: point.imageX,
                        imageY: point.imageY,
                        id: point.id
                    });
                    
                    // 画像左上からの位置を地図座標に変換
                    const imageCoords = this.convertImageCoordsToMapCoords(point.imageX, point.imageY);
                    
                    if (imageCoords) {
                        // 赤丸マーカーを作成（位置を丸の中心とする）
                        const marker = L.circleMarker(imageCoords, {
                            radius: 6,
                            fillColor: '#ff0000',
                            color: '#ffffff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8
                        }).addTo(this.map);
                        
                        if (point.id) {
                            marker.bindPopup(`ポイント(JSON): ${point.id}`);
                        }
                        
                        // JSONマーカーにクリックイベントを追加
                        marker.on('click', (e) => {
                            
                            // イベントの伝播を停止
                            L.DomEvent.stopPropagation(e);
                        });
                        
                        this.pointMarkers.push(marker);
                    }
                }
            });
            
            // ポイント数を表示フィールドに更新
            this.updatePointCountDisplay(pointData.points.length);
        }
    }

    // 画像座標から地図座標への変換
    convertImageCoordsToMapCoords(imageX, imageY) {
        if (!this.imageOverlay || !this.imageOverlay.imageOverlay) {
            return null;
        }

        const bounds = this.imageOverlay.imageOverlay.getBounds();
        const imageBounds = this.imageOverlay.imageOverlay._image;
        
        if (!imageBounds) return null;

        // 画像の実際のサイズ
        const imageWidth = this.imageOverlay.currentImage.naturalWidth;
        const imageHeight = this.imageOverlay.currentImage.naturalHeight;

        // 画像座標を正規化（0-1の範囲）
        const normalizedX = imageX / imageWidth;
        const normalizedY = imageY / imageHeight;

        // 地図座標に変換
        const lat = bounds.getNorth() - (bounds.getNorth() - bounds.getSouth()) * normalizedY;
        const lng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * normalizedX;

        return [lat, lng];
    }

    // ポイントマーカーをクリア
    clearPointMarkers() {
        this.pointMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.pointMarkers = [];
        this.originalPointData = [];
        this.updatePointCountDisplay(0);
        this.updateMatchedPointCountDisplay(0);
        // 不一致ポイント表示をクリア
        const unmatchedPointsField = document.getElementById('unmatchedPointsField');
        if (unmatchedPointsField) {
            unmatchedPointsField.value = '';
        }
    }

    // ポイント数表示を更新
    updatePointCountDisplay(count) {
        const pointCountField = document.getElementById('jsonPointCountField');
        if (pointCountField) {
            pointCountField.value = count.toString();
        }
    }

    // 一致ポイント数表示を更新
    updateMatchedPointCountDisplay(count) {
        const matchedPointCountField = document.getElementById('matchedPointCountField');
        if (matchedPointCountField) {
            matchedPointCountField.value = count.toString();
        }
    }

    // 不一致ポイント一覧を更新
    updateUnmatchedPointsDisplay(matchedPairs) {
        const unmatchedPointsField = document.getElementById('unmatchedPointsField');
        if (!unmatchedPointsField) {
            return;
        }

        if (!this.gpsData || this.originalPointData.length === 0) {
            unmatchedPointsField.value = '';
            return;
        }

        const matchedIds = new Set(matchedPairs.map(pair => pair.jsonPoint.id));
        
        // JSONポイントから不一致のものを抽出
        const unmatchedJsonPoints = this.originalPointData.filter(point => 
            point.id && !matchedIds.has(point.id)
        );

        if (unmatchedJsonPoints.length === 0) {
            unmatchedPointsField.value = '';
        } else {
            // スペース区切りで不一致JSONポイントのIDを表示
            const unmatchedIds = unmatchedJsonPoints.map(point => point.id);
            unmatchedPointsField.value = unmatchedIds.join(' ');
        }
    }

    // 画像の移動・拡大縮小時にポイント位置を更新
    updatePointPositions() {
        if (this.originalPointData.length === 0 || this.pointMarkers.length === 0) {
            return;
        }

        // 元の画像座標から新しい地図座標を計算して、マーカー位置を更新
        this.originalPointData.forEach((originalPoint, index) => {
            if (index < this.pointMarkers.length) {
                const newImageCoords = this.convertImageCoordsToMapCoords(originalPoint.imageX, originalPoint.imageY);
                if (newImageCoords) {
                    this.pointMarkers[index].setLatLng(newImageCoords);
                }
            }
        });
    }

    // ポイントマッチング機能
    matchPointsWithGPS() {
        if (!this.gpsData || this.originalPointData.length === 0) {
            this.showErrorMessage('マッチングエラー', 'GPSデータまたはポイントデータが見つかりません');
            return;
        }

        const gpsMarkers = this.gpsData.getGPSMarkers();
        if (gpsMarkers.length === 0) {
            this.showErrorMessage('マッチングエラー', 'GPS マーカーが見つかりませんでした');
            return;
        }

        // ID 名が一致するマーカーペアを検索
        const matchedPairs = [];
        this.originalPointData.forEach((jsonPoint, index) => {
            const matchingGPS = gpsMarkers.find(gps => gps.id === jsonPoint.id);
            if (matchingGPS && index < this.pointMarkers.length) {
                matchedPairs.push({
                    jsonPoint: jsonPoint,
                    gpsPoint: matchingGPS,
                    jsonMarker: this.pointMarkers[index]
                });
            }
        });

        // 一致数を表示
        this.updateMatchedPointCountDisplay(matchedPairs.length);
        
        // 不一致ポイントの一覧を表示
        this.updateUnmatchedPointsDisplay(matchedPairs);
    }

    // GPS マーカーとポイント JSON マーカーの自動調整
    autoAdjustImageToGPS() {
        if (!this.gpsData || !this.imageOverlay || this.originalPointData.length === 0) {
            this.showErrorMessage('調整エラー', 'GPSデータ、画像、またはポイントデータが見つかりません');
            return;
        }

        const gpsMarkers = this.gpsData.getGPSMarkers();
        if (gpsMarkers.length === 0) {
            this.showErrorMessage('調整エラー', 'GPS マーカーが見つかりませんでした');
            return;
        }

        // ID 名が一致するマーカーペアを検索
        const matchedPairs = [];
        this.originalPointData.forEach((jsonPoint, index) => {
            const matchingGPS = gpsMarkers.find(gps => gps.id === jsonPoint.id);
            if (matchingGPS && index < this.pointMarkers.length) {
                matchedPairs.push({
                    jsonPoint: jsonPoint,
                    gpsPoint: matchingGPS,
                    jsonMarker: this.pointMarkers[index]
                });
            }
        });

        if (matchedPairs.length < 2) {
            this.showErrorMessage('調整エラー', '自動調整には少なくとも2つの一致するマーカーが必要です');
            return;
        }

        // 最適な画像調整を計算（全ポイントを使用した最小二乗法）
        this.calculateOptimalImageAdjustment(matchedPairs);
    }

    // 最適化された画像調整パラメータを計算（全ポイントを使用した最小二乗法）
    calculateOptimalImageAdjustment(matchedPairs) {
        // 全ペアのデータ妥当性をチェック
        for (const pair of matchedPairs) {
            if (!pair.gpsPoint || !pair.jsonPoint ||
                typeof pair.gpsPoint.lat !== 'number' || typeof pair.gpsPoint.lng !== 'number' ||
                typeof pair.jsonPoint.imageX !== 'number' || typeof pair.jsonPoint.imageY !== 'number') {
                this.showErrorMessage('調整エラー', 'マーカーペアのデータが不完全または無効です');
                return;
            }
        }

        // 最適なパラメータを反復計算で求める
        const result = this.optimizeImageParameters(matchedPairs);
        
        if (!result) {
            this.showErrorMessage('調整エラー', '最適化計算に失敗しました');
            return;
        }

        // 最適化結果を適用
        this.applyImageAdjustment(result.centerLat, result.centerLng, result.scale);
    }

    // 最小二乗法による最適パラメータ計算
    optimizeImageParameters(matchedPairs) {
        // 初期推定値を設定
        let bestCenterLat = matchedPairs.reduce((sum, pair) => sum + pair.gpsPoint.lat, 0) / matchedPairs.length;
        let bestCenterLng = matchedPairs.reduce((sum, pair) => sum + pair.gpsPoint.lng, 0) / matchedPairs.length;
        
        // 初期スケールをより適切に推定
        const initialScale = this.estimateInitialScale(matchedPairs, bestCenterLat, bestCenterLng);
        const currentScaleValue = this.imageOverlay ? this.imageOverlay.getCurrentScale() : 0.8;
        let bestScale = initialScale > 0 ? initialScale : currentScaleValue;


        let bestError = this.calculateTotalError(matchedPairs, bestCenterLat, bestCenterLng, bestScale);

        // 格子探索による最適化
        const iterations = 50;
        const learningRate = 0.1;

        for (let iter = 0; iter < iterations; iter++) {
            // 中心位置の最適化
            const latStep = 0.0001 * Math.pow(0.9, iter);
            const lngStep = 0.0001 * Math.pow(0.9, iter);
            
            // 緯度方向の探索
            for (const deltaLat of [-latStep, 0, latStep]) {
                for (const deltaLng of [-lngStep, 0, lngStep]) {
                    const testLat = bestCenterLat + deltaLat;
                    const testLng = bestCenterLng + deltaLng;
                    
                    // この位置での最適スケールを計算
                    const optimalScale = this.calculateOptimalScale(matchedPairs, testLat, testLng);
                    
                    if (optimalScale > 0) {
                        const error = this.calculateTotalError(matchedPairs, testLat, testLng, optimalScale);
                        
                        if (error < bestError) {
                            bestError = error;
                            bestCenterLat = testLat;
                            bestCenterLng = testLng;
                            bestScale = optimalScale;
                        }
                    }
                }
            }
        }

        // 計算結果の妥当性チェック
        if (!isFinite(bestCenterLat) || !isFinite(bestCenterLng) || !isFinite(bestScale) || bestScale <= 0) {
            return null;
        }

        return {
            centerLat: bestCenterLat,
            centerLng: bestCenterLng,
            scale: bestScale,
            totalError: bestError
        };
    }

    // 指定された中心位置での最適スケールを計算
    calculateOptimalScale(matchedPairs, centerLat, centerLng) {
        let numerator = 0;
        let denominator = 0;


        for (const pair of matchedPairs) {
            // GPS座標間の距離を計算（km単位）
            const gpsDistance = this.calculateDistance(centerLat, centerLng, pair.gpsPoint.lat, pair.gpsPoint.lng);
            
            // 画像座標間の距離を計算（ピクセル単位）
            const imageWidth = this.imageOverlay.currentImage.naturalWidth || this.imageOverlay.currentImage.width;
            const imageHeight = this.imageOverlay.currentImage.naturalHeight || this.imageOverlay.currentImage.height;
            
            // 画像中心からの相対位置（ピクセル単位）
            const centerX = imageWidth / 2;
            const centerY = imageHeight / 2;
            const offsetX = pair.jsonPoint.imageX - centerX;
            const offsetY = pair.jsonPoint.imageY - centerY;
            const imagePixelDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            
            
            if (imagePixelDistance > 0) {
                // GPS距離(km) / 画像ピクセル距離 = km/pixel の比率
                const ratio = gpsDistance / imagePixelDistance;
                numerator += ratio * imagePixelDistance * imagePixelDistance;
                denominator += imagePixelDistance * imagePixelDistance;
            }
        }

        // ピクセルあたりのkm数を計算
        const kmPerPixel = denominator > 0 ? numerator / denominator : 0;
        
        // 現在の地図投影での1ピクセルあたりのメートル数を計算
        const metersPerPixel = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, this.map.getZoom());
        
        // スケール = (実際のkm/pixel) / (地図投影のkm/pixel)
        const optimalScale = kmPerPixel / (metersPerPixel / 1000);
        

        return Math.max(optimalScale, 0.001); // 最小値を設定
    }

    // 初期スケールを推定
    estimateInitialScale(matchedPairs, centerLat, centerLng) {
        if (matchedPairs.length < 2) return 0;

        // 最初の2つのペアを使用して初期スケールを推定
        const pair1 = matchedPairs[0];
        const pair2 = matchedPairs[1];

        // GPS距離を計算（km単位）
        const gpsDistance = this.calculateDistance(
            pair1.gpsPoint.lat, pair1.gpsPoint.lng,
            pair2.gpsPoint.lat, pair2.gpsPoint.lng
        );

        // 画像座標の距離を計算（ピクセル単位）
        const imagePixelDistance = Math.sqrt(
            Math.pow(pair2.jsonPoint.imageX - pair1.jsonPoint.imageX, 2) + 
            Math.pow(pair2.jsonPoint.imageY - pair1.jsonPoint.imageY, 2)
        );

        if (imagePixelDistance === 0) return 0;

        // ピクセルあたりのkm数を計算
        const kmPerPixel = gpsDistance / imagePixelDistance;
        
        // 現在の地図投影での1ピクセルあたりのメートル数を計算
        const metersPerPixel = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, this.map.getZoom());

        // スケール = (実際のkm/pixel) / (地図投影のkm/pixel)
        const estimatedScale = kmPerPixel / (metersPerPixel / 1000);


        return Math.max(estimatedScale, 0.001); // 最小値を設定
    }

    // 総誤差を計算
    calculateTotalError(matchedPairs, centerLat, centerLng, scale) {
        let totalError = 0;

        for (const pair of matchedPairs) {
            // 画像座標を地図座標に変換
            const predictedCoords = this.convertImageToMapCoords(pair.jsonPoint.imageX, pair.jsonPoint.imageY, centerLat, centerLng, scale);
            
            if (predictedCoords) {
                // GPS座標との距離誤差を計算
                const error = this.calculateDistance(
                    predictedCoords.lat, predictedCoords.lng,
                    pair.gpsPoint.lat, pair.gpsPoint.lng
                );
                totalError += error * error; // 二乗誤差
            }
        }

        return totalError;
    }

    // 画像座標を地図座標に変換（任意の中心とスケールで）
    convertImageToMapCoords(imageX, imageY, centerLat, centerLng, scale) {
        if (!this.imageOverlay || !this.imageOverlay.currentImage) {
            return null;
        }

        // ImageOverlayと同じ方式でピクセル数を取得
        const imageWidth = this.imageOverlay.currentImage.naturalWidth || this.imageOverlay.currentImage.width;
        const imageHeight = this.imageOverlay.currentImage.naturalHeight || this.imageOverlay.currentImage.height;

        // 画像中心からの相対位置（ピクセル単位）
        const offsetX = imageX - imageWidth / 2;
        const offsetY = imageY - imageHeight / 2;

        // ImageOverlayと同じ計算方式を使用
        const metersPerPixel = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, this.map.getZoom());
        
        // スケールを適用してメートル単位に変換
        const scaledOffsetXMeters = offsetX * scale * metersPerPixel;
        const scaledOffsetYMeters = offsetY * scale * metersPerPixel;

        // 地図座標に変換（ImageOverlayのupdateImageDisplayと同じ方式）
        const earthRadius = 6378137;
        const latOffset = (scaledOffsetYMeters / earthRadius) * (180 / Math.PI);
        const lngOffset = (scaledOffsetXMeters / (earthRadius * Math.cos(centerLat * Math.PI / 180))) * (180 / Math.PI);

        return {
            lat: centerLat - latOffset, // Y軸は反転（画像座標系は上が0、地図座標系は北が正）
            lng: centerLng + lngOffset
        };
    }

    // 2点間の距離を計算（km単位）
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // 地球の半径（km）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // 画像調整を適用
    applyImageAdjustment(newCenterLat, newCenterLng, newScale) {
        // 引数の妥当性をチェック
        if (!isFinite(newCenterLat) || !isFinite(newCenterLng) || !isFinite(newScale)) {
            this.showErrorMessage('調整エラー', '画像調整のパラメータが無効です');
            return;
        }


        // 新しいスケールを設定
        if (this.imageOverlay && isFinite(newScale)) {
            this.imageOverlay.setCurrentScale(newScale);
        }
        
        // 中心位置を設定してから画像表示を更新
        const newLatLng = L.latLng(newCenterLat, newCenterLng);
        this.imageOverlay.centerMarker.setLatLng(newLatLng);
        
        // updateImageDisplayを呼び出す（内部でcenterPos = this.centerMarker.getLatLng()により新しい位置を取得）
        if (this.imageOverlay) {
            this.imageOverlay.updateImageDisplay();
        }
        
        // 画像調整後にポイント位置を強制的に更新
        setTimeout(() => {
            this.updatePointPositions();
        }, 100);
    }

    showErrorMessage(title, message) {
        this.showMessage(title, message, '#dc3545');
    }

    showWarningMessage(title, message) {
        this.showMessage(title, message, '#ffc107');
    }

    showMessage(title, message, backgroundColor) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 2px solid ${backgroundColor};
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
            max-width: 400px;
        `;
        messageBox.innerHTML = `
            <h3 style="color: ${backgroundColor}; margin-top: 0;">${title}</h3>
            <p style="white-space: pre-line; color: #333;">${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: ${backgroundColor};
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }
}