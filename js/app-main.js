// メインアプリケーションファイル - 全モジュールを統合
import { MapCore } from './map-core.js';
import { ImageOverlay } from './image-overlay.js';
import { GPSData } from './gps-data.js';
import { PointOverlay } from './point-overlay.js';
import { RouteEditor } from './route-editor.js';
import { ModeSwitcher } from './mode-switcher.js';
import { PointInfoManager } from './point-info-manager.js';
import { PointEditor } from './point-editor.js';
import { CONFIG, EVENTS, DEFAULTS } from './constants.js';
import { Logger } from './utils/logger.js';
import { errorHandler } from './utils/error-handler.js';

class GSIMapApp {
    constructor() {
        this.logger = new Logger('GSIMapApp');
        this.mapCore = null;
        this.imageOverlay = null;
        this.gpsData = null;
        this.pointOverlay = null;
        this.routeEditor = null;
        this.modeSwitcher = null;
        this.pointInfoManager = null;
        this.pointEditor = null;
        
        this.logger.info('GSIMapApp初期化開始');
    }

    async init() {
        try {
            this.logger.info('アプリケーション初期化開始');
            
            // ModeSwitcherは常に初期化（地図に依存しない）
            this.modeSwitcher = new ModeSwitcher();
            this.logger.debug('ModeSwitcher初期化完了');
            
            // コアモジュール初期化
            this.mapCore = new MapCore();
            this.logger.debug('MapCore初期化開始');
            
            // MapCoreの初期化完了を待つ
            await this.mapCore.initPromise;
            this.logger.debug('MapCore初期化Promise完了');
            
            // PointInfoManagerを常に初期化（mapはnullでも可）
            this.pointInfoManager = new PointInfoManager(null);
            this.logger.debug('PointInfoManager初期化完了');
            
            // イベントハンドラー設定（地図の初期化に関係なく実行）
            this.setupEventHandlers();
            this.logger.debug('イベントハンドラー設定完了');
            
            // 地図が初期化されていない場合は、地図関連モジュールの初期化をスキップ
            if (!this.mapCore.getMap()) {
                this.logger.warn('地図の初期化に失敗。地図関連モジュールをスキップします');
                return;
            }
            
            // 地図が初期化された後でPointInfoManagerにマップを設定
            this.pointInfoManager.setMap(this.mapCore.getMap());
            this.logger.debug('PointInfoManagerにマップ設定完了');
            
            // 各機能モジュール初期化
            await this.initializeModules();
            
            this.logger.info('アプリケーション初期化完了');
            
        } catch (error) {
            this.logger.error('アプリケーション初期化中にエラーが発生', error);
            errorHandler.showError('初期化エラー', 'アプリケーションの初期化中にエラーが発生しました。');
        }
    }
    
    /**
     * 各機能モジュールを初期化
     */
    async initializeModules() {
        try {
            // ImageOverlay初期化
            this.imageOverlay = new ImageOverlay(this.mapCore);
            this.logger.debug('ImageOverlay初期化完了');
            
            // GPSData初期化
            this.gpsData = new GPSData(this.mapCore.getMap(), this.pointInfoManager);
            this.logger.debug('GPSData初期化完了');
            
            // ImageOverlayの初期化完了を少し待ってからPointOverlayを初期化
            await new Promise(resolve => setTimeout(resolve, CONFIG.POINT_OVERLAY_INIT_DELAY));
            this.pointOverlay = new PointOverlay(this.mapCore.getMap(), this.imageOverlay, this.gpsData);
            this.logger.debug('PointOverlay初期化完了');
            
            // RouteEditor初期化
            this.routeEditor = new RouteEditor(this.mapCore.getMap(), this.imageOverlay, this.gpsData);
            this.logger.debug('RouteEditor初期化完了');
            
            // ポイント編集機能を初期化
            this.pointEditor = new PointEditor(this.mapCore.getMap(), this.gpsData);
            this.logger.debug('PointEditor初期化完了');
            
            // 既存のGPSデータからポイントを読み込み
            this.pointEditor.loadExistingPoints();
            this.logger.debug('既存GPSポイント読み込み完了');
            
        } catch (error) {
            this.logger.error('モジュール初期化中にエラーが発生', error);
            throw error;
        }
    }

    // MapCoreの初期化完了を待つヘルパーメソッド
    async waitForMapInitialization() {
        let attempts = 0;
        const maxAttempts = 50; // 最大5秒待機
        
        this.logger.debug('地図初期化待機開始');
        
        while (!this.mapCore.getMap() && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            
            if (attempts % 10 === 0) {
                this.logger.debug(`地図初期化待機中... ${attempts * 100}ms経過`);
            }
        }
        
        if (!this.mapCore.getMap()) {
            this.logger.warn('地図初期化タイムアウト');
        } else {
            this.logger.debug(`地図初期化完了 (${attempts * 100}ms)`);
        }
    }

    setupEventHandlers() {
        // 画像読み込みボタンのイベントハンドラー
        const loadImageBtn = document.getElementById('loadImageBtn');
        const imageInput = document.getElementById('imageInput');
        
        if (loadImageBtn && imageInput) {
            loadImageBtn.addEventListener('click', () => {
                imageInput.click();
            });
            
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type === 'image/png') {
                    // ImageOverlayモジュールが初期化されていない場合は初期化
                    if (!this.imageOverlay) {
                        if (this.mapCore) {
                            this.imageOverlay = new ImageOverlay(this.mapCore);
                        } else {
                            this.showErrorMessage('画像読み込みエラー', '地図が初期化されていません。');
                            return;
                        }
                    }
                    
                    this.imageOverlay.loadImage(file).catch(error => {
                        this.showErrorMessage('画像読み込みエラー', error.message);
                    });
                } else if (file) {
                    this.showErrorMessage('ファイル形式エラー', 'PNG形式の画像ファイルを選択してください。');
                }
            });
        }

        // GPS読み込みボタンのイベントハンドラー
        const loadGpsBtn = document.getElementById('loadGpsBtn');
        const gpsCsvInput = document.getElementById('gpsCsvInput');
        
        if (loadGpsBtn && gpsCsvInput) {
            loadGpsBtn.addEventListener('click', () => {
                gpsCsvInput.click();
            });
            
            gpsCsvInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // GPSDataモジュールが初期化されていない場合は初期化
                    if (!this.gpsData) {
                        if (this.mapCore && this.mapCore.getMap()) {
                            this.gpsData = new GPSData(this.mapCore.getMap(), this.pointInfoManager);
                        } else {
                            this.showErrorMessage('GPS データ読み込みエラー', '地図が初期化されていません。');
                            return;
                        }
                    }
                    
                    this.gpsData.loadGPSData(file).then(() => {
                        // GPS読み込み成功後、PointEditorのイベントハンドラーを更新
                        if (this.pointEditor) {
                            this.pointEditor.refreshExistingMarkerEvents();
                        }
                    }).catch(error => {
                        this.showErrorMessage('GPS データ読み込みエラー', error.message);
                    });
                }
            });
        }

    }

    showErrorMessage(title, message) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
        `;
        messageBox.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: #007bff;
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', async () => {
    const app = new GSIMapApp();
    await app.init();
});