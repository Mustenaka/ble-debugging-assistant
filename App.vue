<script>
import { useBleStore } from './store/bleStore'

export default {
  onLaunch() {
    // App启动时初始化系统样式（由各页面 onMounted 调用 applySystemStyle）
  },
  onShow() {
    // 从后台回到前台：恢复 RSSI 轮询并验证 BLE 连接是否仍有效
    const bleStore = useBleStore()
    bleStore.onAppForeground()
  },
  onHide() {
    // 进入后台：暂停 RSSI 轮询节省电量，停止扫描
    const bleStore = useBleStore()
    bleStore.onAppBackground()
  },
}
</script>

<style lang="scss">
/* ═══════════════════════════════════════════════════════
   主题 CSS 变量系统
   通过 .theme-dark / .theme-light class 切换
   ═══════════════════════════════════════════════════════ */

/* ── 暗色主题 ── */
.theme-dark {
  --bg-base:           #0A0F1C;
  --bg-panel:          #111827;
  --bg-card:           #1A2235;
  --bg-elevated:       #1E2D44;
  --bg-input:          #0D1526;
  --bg-overlay:        rgba(10,15,28,0.95);
  --color-primary:     #00F5FF;
  --color-primary-rgb: 0,245,255;
  --color-accent:      #39FF14;
  --color-accent-rgb:  57,255,20;
  --color-warning:     #F59E0B;
  --color-warning-rgb: 245,158,11;
  --color-danger:      #FF3B3B;
  --color-danger-rgb:  255,59,59;
  --color-info:        #60A5FA;
  --color-purple:      #8B5CF6;
  --text-primary:      #E2E8F0;
  --text-secondary:    #94A3B8;
  --text-muted:        #475569;
  --text-dimmed:       #334155;
  --text-mono:         #A8D8A8;
  --border-subtle:     rgba(0,245,255,0.08);
  --border-default:    rgba(0,245,255,0.15);
  --border-active:     rgba(0,245,255,0.5);
  --border-card:       rgba(255,255,255,0.06);
  --shadow-card:       0 4px 20px rgba(0,0,0,0.4);
  --nav-bg:            #0A0F1C;
  --nav-front:         #ffffff;
  --badge-tx-bg:       rgba(96,165,250,0.2);
  --badge-tx-color:    #60A5FA;
  --badge-rx-bg:       rgba(57,255,20,0.2);
  --badge-rx-color:    #39FF14;
  --badge-sys-bg:      rgba(245,158,11,0.2);
  --badge-sys-color:   #F59E0B;
  --entry-tx-bg:       rgba(96,165,250,0.05);
  --entry-tx-border:   #60A5FA;
  --entry-rx-bg:       rgba(57,255,20,0.05);
  --entry-rx-border:   #39FF14;
  --entry-sys-bg:      rgba(245,158,11,0.05);
  --entry-sys-border:  #F59E0B;
  --data-hex-tx:       #93C5FD;
  --data-hex-rx:       #86EFAC;
  --data-ascii-tx:     #60A5FA;
  --data-ascii-rx:     #39FF14;
  --scan-ring-color:   rgba(0,245,255,0.6);
  --scan-sweep-start:  rgba(0,245,255,0.15);
  --scan-sweep-end:    rgba(0,245,255,0.4);
}

/* ── 亮色主题 ── */
.theme-light {
  --bg-base:           #EDF2F7;
  --bg-panel:          #FFFFFF;
  --bg-card:           #F7FAFC;
  --bg-elevated:       #EBF4FF;
  --bg-input:          #FFFFFF;
  --bg-overlay:        rgba(237,242,247,0.97);
  --color-primary:     #0369A1;
  --color-primary-rgb: 3,105,161;
  --color-accent:      #059669;
  --color-accent-rgb:  5,150,105;
  --color-warning:     #D97706;
  --color-warning-rgb: 217,119,6;
  --color-danger:      #DC2626;
  --color-danger-rgb:  220,38,38;
  --color-info:        #2563EB;
  --color-purple:      #7C3AED;
  --text-primary:      #1A202C;
  --text-secondary:    #4A5568;
  --text-muted:        #718096;
  --text-dimmed:       #A0AEC0;
  --text-mono:         #1A5F2E;
  --border-subtle:     rgba(3,105,161,0.1);
  --border-default:    rgba(3,105,161,0.2);
  --border-active:     rgba(3,105,161,0.5);
  --border-card:       rgba(3,105,161,0.08);
  --shadow-card:       0 2px 12px rgba(0,0,0,0.08);
  --nav-bg:            #FFFFFF;
  --nav-front:         #000000;
  --badge-tx-bg:       rgba(37,99,235,0.12);
  --badge-tx-color:    #2563EB;
  --badge-rx-bg:       rgba(5,150,105,0.12);
  --badge-rx-color:    #059669;
  --badge-sys-bg:      rgba(217,119,6,0.12);
  --badge-sys-color:   #D97706;
  --entry-tx-bg:       rgba(37,99,235,0.04);
  --entry-tx-border:   #2563EB;
  --entry-rx-bg:       rgba(5,150,105,0.04);
  --entry-rx-border:   #059669;
  --entry-sys-bg:      rgba(217,119,6,0.04);
  --entry-sys-border:  #D97706;
  --data-hex-tx:       #1D4ED8;
  --data-hex-rx:       #065F46;
  --data-ascii-tx:     #2563EB;
  --data-ascii-rx:     #059669;
  --scan-ring-color:   rgba(3,105,161,0.5);
  --scan-sweep-start:  rgba(3,105,161,0.1);
  --scan-sweep-end:    rgba(3,105,161,0.3);
}

/* ═══════════════════════════════════════════════════════
   全局重置 & 工具类
   ═══════════════════════════════════════════════════════ */
page {
  background-color: #0A0F1C;
  color: #E2E8F0;
  font-size: 14px;
  line-height: 1.5;
}

* { box-sizing: border-box; }
::-webkit-scrollbar { display: none; }

/* ── 通用布局 ── */
.flex            { display: flex; }
.flex-col        { display: flex; flex-direction: column; }
.flex-1          { flex: 1; }
.items-center    { align-items: center; }
.justify-between { justify-content: space-between; }
.flex-wrap       { flex-wrap: wrap; }

/* ── 通用动画 ── */
@keyframes ble-blink   { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes ble-spin    { to{transform:rotate(360deg)} }
@keyframes ble-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes ble-pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }

.anim-blink   { animation: ble-blink   1s ease-in-out infinite; }
.anim-fade-in { animation: ble-fade-in 0.28s ease-out; }
.anim-spin    { animation: ble-spin    0.9s linear infinite; }

/* ── 等宽字体 ── */
.mono {
  font-family: 'Courier New', 'Consolas', 'SF Mono', monospace;
  letter-spacing: 0.4px;
}
</style>
