// ポイント情報管理クラス - クリックされたポイントの詳細情報を管理
export class PointInfoManager {
    constructor(map) {
        this.map = map;
        this.container = document.getElementById('pointInfoContainer');
        this.currentPoint = null;
        this.setupEventHandlers();
        
        // mapがnullでない場合のみMapClickHandlerを設定
        if (this.map) {
            this.setupMapClickHandler();
        }
    }

    // 10進数緯度経度をDMS形式に変換
    decimalToDMS(decimal, isLongitude = false) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutes = Math.floor((absolute - degrees) * 60);
        const seconds = ((absolute - degrees) * 60 - minutes) * 60;
        
        const direction = decimal >= 0 
            ? (isLongitude ? 'E' : 'N')
            : (isLongitude ? 'W' : 'S');
        
        return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toFixed(2).padStart(5, '0')}"${direction}`;
    }

    // 緯度経度をDMS統合形式に変換（例: 34°51'03.73"N 135°27'08.38"E）
    coordinatesToDMS(lat, lng) {
        if (lat === '' || lng === '' || lat === null || lng === null) {
            return '';
        }
        const latDMS = this.decimalToDMS(parseFloat(lat), false);
        const lngDMS = this.decimalToDMS(parseFloat(lng), true);
        return `${latDMS} ${lngDMS}`;
    }

    // 10進数座標を小数点以下5桁に丸める
    roundToFiveDecimals(decimal) {
        if (decimal === '' || decimal === null || isNaN(decimal)) {
            return '';
        }
        return parseFloat(decimal).toFixed(5);
    }

    // DMS形式を10進数に変換
    dmsToDecimal(dmsString) {
        const match = dmsString.match(/(\d+)°(\d+)'([\d.]+)"([NSEW])/);
        if (!match) return null;
        
        const [, degrees, minutes, seconds, direction] = match;
        let decimal = parseInt(degrees) + parseInt(minutes) / 60 + parseFloat(seconds) / 3600;
        
        if (direction === 'S' || direction === 'W') {
            decimal = -decimal;
        }
        
        return decimal;
    }


    // ポイント情報フィールドを表示
    showPointInfo(pointData = {}) {
        // コンテナは常に表示済み（デフォルト表示）
        this.currentPoint = pointData;

        // フィールドに値を設定
        document.getElementById('pointIdField').value = pointData.id || '';
        
        const latDecimal = pointData.lat || '';
        const lngDecimal = pointData.lng || '';
        
        // 緯度・経度を小数点以下5桁で表示
        document.getElementById('latDecimalField').value = this.roundToFiveDecimals(latDecimal);
        document.getElementById('lngDecimalField').value = this.roundToFiveDecimals(lngDecimal);
        
        // DMS統合形式で表示
        document.getElementById('dmsField').value = this.coordinatesToDMS(latDecimal, lngDecimal);
        
        document.getElementById('elevationField').value = pointData.elevation || '';
        document.getElementById('locationField').value = pointData.location || '';
        
        // GPS標高を自動取得・表示
        if (latDecimal && lngDecimal) {
            this.fetchGpsElevation(latDecimal, lngDecimal);
        } else {
            document.getElementById('gpsElevationField').value = '';
        }
    }

    // ポイント情報フィールドをクリア
    clearPointInfo() {
        // フィールドをクリアするが、コンテナは表示したまま
        document.getElementById('pointIdField').value = '';
        document.getElementById('latDecimalField').value = '';
        document.getElementById('lngDecimalField').value = '';
        document.getElementById('dmsField').value = '';
        document.getElementById('elevationField').value = '';
        document.getElementById('locationField').value = '';
        this.currentPoint = null;
    }

    // 座標クリック時の処理
    onMapClick(lat, lng, pointData = null) {
        if (pointData) {
            // 登録済みポイントがクリックされた場合
            this.showPointInfo({
                id: pointData.id || '',
                lat: lat,
                lng: lng,
                elevation: pointData.elevation || '',
                location: pointData.location || pointData.name || ''
            });
        } else {
            // 未登録地点がクリックされた場合
            this.showPointInfo({
                id: '',
                lat: lat,
                lng: lng,
                elevation: '',
                location: ''
            });
        }
    }

    // イベントハンドラーの設定
    setupEventHandlers() {
        // 緯度の10進数フィールドが変更された時のDMS自動更新
        const latDecimalField = document.getElementById('latDecimalField');
        latDecimalField.addEventListener('input', (e) => {
            const decimal = parseFloat(e.target.value);
            if (!isNaN(decimal)) {
                // 小数点以下5桁で表示
                e.target.value = this.roundToFiveDecimals(decimal);
                
                // DMS統合形式を更新
                const lngValue = document.getElementById('lngDecimalField').value;
                document.getElementById('dmsField').value = this.coordinatesToDMS(decimal, lngValue);
                
                // GPS標高を自動更新
                if (lngValue && !isNaN(parseFloat(lngValue))) {
                    this.fetchGpsElevation(decimal, parseFloat(lngValue));
                }
                
                if (this.currentPoint) {
                    this.currentPoint.lat = decimal;
                }
            } else {
                document.getElementById('dmsField').value = this.coordinatesToDMS('', document.getElementById('lngDecimalField').value);
            }
        });

        // 経度の10進数フィールドが変更された時のDMS自動更新
        const lngDecimalField = document.getElementById('lngDecimalField');
        lngDecimalField.addEventListener('input', (e) => {
            const decimal = parseFloat(e.target.value);
            if (!isNaN(decimal)) {
                // 小数点以下5桁で表示
                e.target.value = this.roundToFiveDecimals(decimal);
                
                // DMS統合形式を更新
                const latValue = document.getElementById('latDecimalField').value;
                document.getElementById('dmsField').value = this.coordinatesToDMS(latValue, decimal);
                
                // GPS標高を自動更新
                if (latValue && !isNaN(parseFloat(latValue))) {
                    this.fetchGpsElevation(parseFloat(latValue), decimal);
                }
                
                if (this.currentPoint) {
                    this.currentPoint.lng = decimal;
                }
            } else {
                document.getElementById('dmsField').value = this.coordinatesToDMS(document.getElementById('latDecimalField').value, '');
            }
        });

        // 場所フィールドが変更された時の更新
        const locationField = document.getElementById('locationField');
        locationField.addEventListener('input', (e) => {
            if (this.currentPoint) {
                this.currentPoint.location = e.target.value;
            }
        });
    }

    // 地図クリックハンドラーの設定
    setupMapClickHandler() {
        if (!this.map) {
            return;
        }
        
        this.map.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            // クリック位置にポイントがあるかチェック
            // 現在はシンプルに未登録として処理
            this.onMapClick(lat, lng, null);
        });
    }

    // マップオブジェクトを後から設定する
    setMap(map) {
        this.map = map;
        if (this.map) {
            this.setupMapClickHandler();
        }
    }

    // 現在のポイント情報を取得
    getCurrentPointInfo() {
        if (!this.currentPoint) return null;
        
        return {
            id: document.getElementById('pointIdField').value,
            lat: parseFloat(document.getElementById('latDecimalField').value),
            lng: parseFloat(document.getElementById('lngDecimalField').value),
            elevation: document.getElementById('elevationField').value,
            location: document.getElementById('locationField').value
        };
    }

    // 地理院地図のAPIからGPS標高を取得
    async fetchGpsElevation(lat, lng) {
        const gpsElevationField = document.getElementById('gpsElevationField');
        if (!gpsElevationField) return;
        
        try {
            // 地理院地図の標高API
            const response = await fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`);
            const data = await response.json();
            
            if (data && data.elevation !== undefined && data.elevation !== null) {
                const elevation = Math.round(data.elevation); // 四捨五入して整数部のみ
                gpsElevationField.value = elevation.toString(); // 数値のみを表示
            } else {
                gpsElevationField.value = '';
            }
        } catch (error) {
            gpsElevationField.value = '';
            // GPS標高取得エラー（無視）
        }
    }
}