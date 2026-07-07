#include <QApplication>
#include <QMessageBox>
#include <QTextCodec>
#include <QScreen>
#include "database.h"
#include "mainwindow.h"
#include <cstdlib>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    QTextCodec::setCodecForLocale(QTextCodec::codecForName("UTF-8"));

    // 以 800×480 为基准（嵌入式小屏参考分辨率），较大屏幕等比放大
    QScreen *scr = QApplication::primaryScreen();
    int sw = scr ? scr->geometry().width()  : 800;
    int sh = scr ? scr->geometry().height() : 480;
    double s = qBound(0.8, qMin(sw / 800.0, sh / 480.0), 2.0);

    int fsBase    = qRound(13 * s);
    int fsTitle   = qRound(20 * s);
    int fsSub     = qRound(10 * s);
    int fsClock   = qRound(14 * s);
    int fsStatus  = qRound(11 * s);
    int fsMainBtn = qRound(20 * s);
    int fsBtn     = qRound(13 * s);
    int fsTable   = qRound(12 * s);
    int fsInput   = qRound(13 * s);
    int fsBar     = qRound(11 * s);
    int radMain   = qRound(12 * s);
    int radBtn    = qRound(5 * s);
    int padBtnV   = qRound(8 * s);
    int padBtnH   = qRound(20 * s);
    int padInput  = qRound(7 * s);
    int padInputH = qRound(12 * s);

    a.setStyleSheet(QString(
        /* ─── Global ─────────────────────────────── */
        "QWidget {"
        "  font-family: \"Microsoft YaHei\", \"微软雅黑\", sans-serif;"
        "  font-size: %1px; color: #1A2744;"
        "}"
        "QMainWindow { background: #F5F7FA; }"
        "QDialog     { background: #FFFFFF; }"

        /* ─── Header ──────────────────────────────── */
        "QWidget#header { background: #0057B8; }"
        "QLabel#titleLabel {"
        "  color: white; font-size: %2px; font-weight: bold; letter-spacing: 2px;"
        "}"
        "QLabel#subTitleLabel {"
        "  color: rgba(255,255,255,0.65); font-size: %3px; letter-spacing: 1px;"
        "}"
        "QLabel#clockLabel {"
        "  color: white; font-size: %4px;"
        "  font-family: \"Consolas\", \"Courier New\", monospace;"
        "}"
        "QLabel#statusLabel {"
        "  color: #90CAF9; font-size: %5px; font-weight: bold;"
        "}"

        /* ─── Main menu buttons ───────────────────── */
        "QPushButton#mainBtn, QPushButton#chatBtn {"
        "  background: #0057B8; color: white;"
        "  border: none; border-radius: %6px;"
        "  font-size: %7px; font-weight: bold; letter-spacing: 2px;"
        "}"
        "QPushButton#mainBtn:hover, QPushButton#chatBtn:hover {"
        "  background: #0066D6;"
        "}"
        "QPushButton#mainBtn:pressed, QPushButton#chatBtn:pressed {"
        "  background: #004A9E;"
        "}"
        "QPushButton#localAiBtn {"
        "  background: #2E7D32; color: white;"
        "  border: none; border-radius: %6px;"
        "  font-size: %7px; font-weight: bold; letter-spacing: 2px;"
        "}"
        "QPushButton#localAiBtn:hover   { background: #388E3C; }"
        "QPushButton#localAiBtn:pressed { background: #1B5E20; }"

        /* ─── Header buttons ──────────────────────── */
        "QPushButton#adminBtn {"
        "  background: rgba(255,255,255,0.12); color: white;"
        "  border: 1px solid rgba(255,255,255,0.35); border-radius: %8px;"
        "  font-size: %9px; padding: 6px 14px; min-width: 0; min-height: 0;"
        "}"
        "QPushButton#adminBtn:hover {"
        "  background: rgba(255,255,255,0.22);"
        "}"

        /* ─── Regular buttons ─────────────────────── */
        "QPushButton {"
        "  background: #0057B8; color: white; border: none;"
        "  border-radius: %8px; padding: %10px %11px;"
        "  font-size: %9px; font-weight: bold;"
        "}"
        "QPushButton:hover   { background: #0066D6; }"
        "QPushButton:pressed { background: #004A9E; }"
        "QPushButton:disabled { background: #C0CDD8; color: #8898A8; }"

        /* ─── Table ───────────────────────────────── */
        "QTableWidget {"
        "  border: 1px solid #D0DCE8; border-radius: 6px;"
        "  background: white; gridline-color: #EBF0FB;"
        "  selection-background-color: #DCEEFB; selection-color: #004A9E;"
        "  font-size: %12px; alternate-background-color: #F8FAFD; outline: none;"
        "}"
        "QTableWidget::item { padding: 6px 8px; border: none; }"
        "QTableWidget::item:selected { background: #DCEEFB; color: #004A9E; }"
        "QHeaderView::section {"
        "  background: #0057B8; color: white;"
        "  padding: 8px; border: none; font-weight: bold; font-size: %12px;"
        "  border-right: 1px solid rgba(255,255,255,0.2);"
        "}"
        "QHeaderView::section:last { border-right: none; }"

        /* ─── Input ───────────────────────────────── */
        "QLineEdit {"
        "  border: 1.5px solid #D0DCE8; border-radius: %8px;"
        "  padding: %13px %14px; font-size: %15px;"
        "  background: white; color: #1A2744;"
        "}"
        "QLineEdit:focus { border-color: #0057B8; }"

        /* ─── Scrollbar ───────────────────────────── */
        "QScrollBar:vertical {"
        "  background: #EEF3F9; width: 8px; border-radius: 4px; margin: 0;"
        "}"
        "QScrollBar::handle:vertical {"
        "  background: #B0C4D8; border-radius: 4px; min-height: 28px;"
        "}"
        "QScrollBar::handle:vertical:hover { background: #0057B8; }"
        "QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }"
        "QScrollBar:horizontal { height: 0; }"

        /* ─── Status bar ──────────────────────────── */
        "QStatusBar { background: #0057B8; color: rgba(255,255,255,0.85); font-size: %16px; }"
        "QStatusBar::item { border: none; }"

        /* ─── GroupBox ────────────────────────────── */
        "QGroupBox {"
        "  border: 1px solid #D0DCE8; border-radius: 6px;"
        "  margin-top: 10px; color: #1A2744; font-weight: bold;"
        "}"
        "QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }"
    )
    .arg(fsBase)     // %1
    .arg(fsTitle)    // %2
    .arg(fsSub)      // %3
    .arg(fsClock)    // %4
    .arg(fsStatus)   // %5
    .arg(radMain)    // %6
    .arg(fsMainBtn)  // %7
    .arg(radBtn)     // %8
    .arg(fsBtn)      // %9
    .arg(padBtnV)    // %10
    .arg(padBtnH)    // %11
    .arg(fsTable)    // %12
    .arg(padInput)   // %13
    .arg(padInputH)  // %14
    .arg(fsInput)    // %15
    .arg(fsBar)      // %16
    );

    QString dbError;
    if (!initDatabase(&dbError)) {
        QMessageBox::critical(nullptr, "数据库连接失败",
            "错误信息：" + dbError + "\n\n请检查：\n"
            "1. Qt MySQL 驱动（qsqlmysql.dll）是否已安装\n"
            "2. 网络是否可以访问服务器 121.40.169.218:3306\n"
            "3. 数据库账号密码是否正确");
        return -1;
    }
    MainWindow w;
    w.show();
    w.showMaximized();
    return a.exec();
}
