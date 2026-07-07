#include "settingsdialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGroupBox>
#include <QScrollArea>
#include <QApplication>
#include <QScreen>
#include <QCoreApplication>
#include <QTimer>

static QString appBase()
{
    return QCoreApplication::applicationDirPath();
}

SettingsDialog::SettingsDialog(QWidget *parent) : QDialog(parent)
{
    QScreen *scr = QApplication::primaryScreen();
    m_scale = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);

    m_initProc    = new QProcess(this);
    m_cameraProc  = new QProcess(this);
    m_displayProc = new QProcess(this);
    m_packInProc  = new QProcess(this);
    m_initProc->setWorkingDirectory(appBase());
    m_cameraProc->setWorkingDirectory(appBase());
    m_displayProc->setWorkingDirectory(appBase());
    m_packInProc->setWorkingDirectory(appBase());

    setupUI();

    connect(m_initProc, &QProcess::readyReadStandardOutput,
            this, &SettingsDialog::onInitReadyRead);
    connect(m_initProc, &QProcess::readyReadStandardError,
            this, &SettingsDialog::onInitReadyRead);
    connect(m_initProc,
            QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, &SettingsDialog::onInitFinished);
    connect(m_cameraProc, &QProcess::stateChanged,
            this, &SettingsDialog::onCameraStateChanged);
    connect(m_cameraProc, &QProcess::readyReadStandardOutput,
            this, &SettingsDialog::onCameraReadyRead);
    connect(m_cameraProc, &QProcess::readyReadStandardError,
            this, &SettingsDialog::onCameraReadyRead);
    connect(m_displayProc, &QProcess::stateChanged,
            this, &SettingsDialog::onDisplayStateChanged);
    connect(m_displayProc, &QProcess::readyReadStandardOutput,
            this, &SettingsDialog::onDisplayReadyRead);
    connect(m_displayProc, &QProcess::readyReadStandardError,
            this, &SettingsDialog::onDisplayReadyRead);
    connect(m_packInProc, &QProcess::stateChanged,
            this, &SettingsDialog::onPackInStateChanged);
    connect(m_packInProc, &QProcess::readyReadStandardOutput,
            this, &SettingsDialog::onPackInReadyRead);
    connect(m_packInProc, &QProcess::readyReadStandardError,
            this, &SettingsDialog::onPackInReadyRead);
}

SettingsDialog::~SettingsDialog()
{
    if (m_initProc->state()    != QProcess::NotRunning) m_initProc->kill();
    if (m_cameraProc->state()  != QProcess::NotRunning) m_cameraProc->kill();
    if (m_displayProc->state() != QProcess::NotRunning) m_displayProc->kill();
    if (m_packInProc->state()  != QProcess::NotRunning) m_packInProc->kill();
}

QPushButton *SettingsDialog::makeGroupBtn(const QString &text,
    const QString &bg, const QString &hover, const QString &press)
{
    QPushButton *btn = new QPushButton(text, this);
    btn->setFixedHeight(m_btnH);
    btn->setStyleSheet(QString(
        "QPushButton { background:%1; color:white; border:none;"
        "  border-radius:%4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:%2; }"
        "QPushButton:pressed  { background:%3; }"
        "QPushButton:disabled { background:#37474F; color:#546E7A; }"
    ).arg(bg, hover, press).arg(m_btnRad));
    return btn;
}

QGroupBox *SettingsDialog::buildInitBox()
{
    static const QString groupStyle =
        "QGroupBox { border:1px solid #D0DCE8; border-radius:6px;"
        "  margin-top:10px; color:#1A2744; font-weight:bold; }"
        "QGroupBox::title { subcontrol-origin:margin; left:10px; padding:0 4px; }";

    QGroupBox *box = new QGroupBox("虚拟环境", this);
    box->setStyleSheet(groupStyle);

    m_initStatus = new QLabel("● 就绪", box);
    m_initStatus->setStyleSheet("color:#5A7090; font-weight:bold;");

    m_initBtn = makeGroupBtn("激  活", "#1565C0", "#1976D2", "#0D47A1");
    connect(m_initBtn, &QPushButton::clicked, this, &SettingsDialog::runInit);

    m_initLog = new QPlainTextEdit(box);
    m_initLog->setReadOnly(true);
    m_initLog->setFixedHeight(qBound(72, qRound(96 * m_scale), 160));
    m_initLog->setStyleSheet(
        "background:#F5F7FA; color:#1A2744; border:1px solid #D0DCE8;"
        "font-family:monospace; font-size:12px;");

    QHBoxLayout *ctrl = new QHBoxLayout();
    ctrl->addWidget(m_initStatus);
    ctrl->addStretch();
    ctrl->addWidget(m_initBtn);

    QVBoxLayout *lay = new QVBoxLayout(box);
    lay->addLayout(ctrl);
    lay->addWidget(m_initLog);
    return box;
}

QGroupBox *SettingsDialog::buildCameraBox()
{
    static const QString groupStyle =
        "QGroupBox { border:1px solid #D0DCE8; border-radius:6px;"
        "  margin-top:10px; color:#1A2744; font-weight:bold; }"
        "QGroupBox::title { subcontrol-origin:margin; left:10px; padding:0 4px; }";

    QGroupBox *box = new QGroupBox("摄像头识别", this);
    box->setStyleSheet(groupStyle);

    m_cameraStatus = new QLabel("● 未运行", box);
    m_cameraStatus->setStyleSheet("color:#5A7090; font-weight:bold;");

    m_startCamBtn = makeGroupBtn("启  动", "#2E7D32", "#388E3C", "#1B5E20");
    m_stopCamBtn  = makeGroupBtn("停  止", "#C62828", "#D32F2F", "#B71C1C");
    m_stopCamBtn->setEnabled(false);
    connect(m_startCamBtn, &QPushButton::clicked, this, &SettingsDialog::startCamera);
    connect(m_stopCamBtn,  &QPushButton::clicked, this, &SettingsDialog::stopCamera);

    m_cameraLog = new QPlainTextEdit(box);
    m_cameraLog->setReadOnly(true);
    m_cameraLog->setFixedHeight(qBound(48, qRound(60 * m_scale), 96));
    m_cameraLog->setStyleSheet(
        "background:#F5F7FA; color:#1A2744; border:1px solid #D0DCE8;"
        "font-family:monospace; font-size:11px;");

    QHBoxLayout *ctrl = new QHBoxLayout();
    ctrl->addWidget(m_cameraStatus);
    ctrl->addStretch();
    ctrl->addWidget(m_startCamBtn);
    ctrl->addSpacing(8);
    ctrl->addWidget(m_stopCamBtn);

    QVBoxLayout *lay = new QVBoxLayout(box);
    lay->addLayout(ctrl);
    lay->addWidget(m_cameraLog);
    return box;
}

QGroupBox *SettingsDialog::buildDisplayBox()
{
    static const QString groupStyle =
        "QGroupBox { border:1px solid #D0DCE8; border-radius:6px;"
        "  margin-top:10px; color:#1A2744; font-weight:bold; }"
        "QGroupBox::title { subcontrol-origin:margin; left:10px; padding:0 4px; }";

    QGroupBox *box = new QGroupBox("大屏显示", this);
    box->setStyleSheet(groupStyle);

    m_displayStatus = new QLabel("● 未运行", box);
    m_displayStatus->setStyleSheet("color:#5A7090; font-weight:bold;");

    m_startDisplayBtn = makeGroupBtn("启  动", "#2E7D32", "#388E3C", "#1B5E20");
    m_stopDisplayBtn  = makeGroupBtn("停  止", "#C62828", "#D32F2F", "#B71C1C");
    m_stopDisplayBtn->setEnabled(false);
    connect(m_startDisplayBtn, &QPushButton::clicked, this, &SettingsDialog::startDisplay);
    connect(m_stopDisplayBtn,  &QPushButton::clicked, this, &SettingsDialog::stopDisplay);

    m_displayLog = new QPlainTextEdit(box);
    m_displayLog->setReadOnly(true);
    m_displayLog->setFixedHeight(qBound(48, qRound(60 * m_scale), 96));
    m_displayLog->setStyleSheet(
        "background:#F5F7FA; color:#1A2744; border:1px solid #D0DCE8;"
        "font-family:monospace; font-size:11px;");

    QHBoxLayout *ctrl = new QHBoxLayout();
    ctrl->addWidget(m_displayStatus);
    ctrl->addStretch();
    ctrl->addWidget(m_startDisplayBtn);
    ctrl->addSpacing(8);
    ctrl->addWidget(m_stopDisplayBtn);

    QVBoxLayout *lay = new QVBoxLayout(box);
    lay->addLayout(ctrl);
    lay->addWidget(m_displayLog);
    return box;
}

QGroupBox *SettingsDialog::buildPackInBox()
{
    static const QString groupStyle =
        "QGroupBox { border:1px solid #D0DCE8; border-radius:6px;"
        "  margin-top:10px; color:#1A2744; font-weight:bold; }"
        "QGroupBox::title { subcontrol-origin:margin; left:10px; padding:0 4px; }";

    QGroupBox *box = new QGroupBox("包裹入库", this);
    box->setStyleSheet(groupStyle);

    m_packInStatus = new QLabel("● 未运行", box);
    m_packInStatus->setStyleSheet("color:#5A7090; font-weight:bold;");

    m_startPackInBtn = makeGroupBtn("启  动", "#2E7D32", "#388E3C", "#1B5E20");
    m_stopPackInBtn  = makeGroupBtn("停  止", "#C62828", "#D32F2F", "#B71C1C");
    m_stopPackInBtn->setEnabled(false);
    connect(m_startPackInBtn, &QPushButton::clicked, this, &SettingsDialog::startPackIn);
    connect(m_stopPackInBtn,  &QPushButton::clicked, this, &SettingsDialog::stopPackIn);

    m_packInLog = new QPlainTextEdit(box);
    m_packInLog->setReadOnly(true);
    m_packInLog->setFixedHeight(qBound(48, qRound(60 * m_scale), 96));
    m_packInLog->setStyleSheet(
        "background:#F5F7FA; color:#1A2744; border:1px solid #D0DCE8;"
        "font-family:monospace; font-size:11px;");

    QHBoxLayout *ctrl = new QHBoxLayout();
    ctrl->addWidget(m_packInStatus);
    ctrl->addStretch();
    ctrl->addWidget(m_startPackInBtn);
    ctrl->addSpacing(8);
    ctrl->addWidget(m_stopPackInBtn);

    QVBoxLayout *lay = new QVBoxLayout(box);
    lay->addLayout(ctrl);
    lay->addWidget(m_packInLog);
    return box;
}

void SettingsDialog::setupUI()
{
    setWindowTitle("系统设置");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);
    setMinimumSize(480, 400);
    resize(qRound(580 * m_scale), qRound(520 * m_scale));

    m_btnH   = qBound(32, qRound(40 * m_scale), 72);
    m_btnRad = m_btnH / 2;

    QPushButton *closeBtn = makeGroupBtn("关  闭", "#546E7A", "#607D8B", "#37474F");
    connect(closeBtn, &QPushButton::clicked, this, &QWidget::hide);

    QHBoxLayout *bottomRow = new QHBoxLayout();
    bottomRow->addStretch();
    bottomRow->addWidget(closeBtn);

    QWidget *scrollContent = new QWidget();
    QVBoxLayout *scrollLayout = new QVBoxLayout(scrollContent);
    scrollLayout->setContentsMargins(0, 0, 0, 0);
    scrollLayout->setSpacing(12);
    scrollLayout->addWidget(buildInitBox());
    scrollLayout->addWidget(buildCameraBox());
    scrollLayout->addWidget(buildDisplayBox());
    scrollLayout->addWidget(buildPackInBox());
    scrollLayout->addStretch();

    QScrollArea *scrollArea = new QScrollArea(this);
    scrollArea->setWidget(scrollContent);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    scrollArea->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    scrollArea->setStyleSheet(
        "QScrollBar:vertical { width:6px; background:transparent; }"
        "QScrollBar::handle:vertical { background:#B0BEC5; border-radius:3px; min-height:20px; }"
        "QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height:0; }");

    QVBoxLayout *layout = new QVBoxLayout(this);
    layout->setContentsMargins(16, 16, 16, 16);
    layout->setSpacing(12);
    layout->addWidget(scrollArea);
    layout->addLayout(bottomRow);
}

// ── 槽 ─────────────────────────────────────────────────────────────────────

void SettingsDialog::runInit()
{
    if (m_initProc->state() != QProcess::NotRunning) return;

    m_initLog->clear();
    m_initStatus->setText("● 激活中");
    m_initStatus->setStyleSheet("color:#E65100; font-weight:bold;");
    m_initBtn->setEnabled(false);

    // source 只在当前 shell 生效，用 bash -c 将激活和验证合并执行
    m_initProc->start("bash", {"-c",
        "source ~/demo_env/bin/activate && python3 --version && echo '虚拟环境就绪'"});
}

void SettingsDialog::startCamera()
{
    if (m_cameraProc->state() != QProcess::NotRunning) return;
    m_cameraLog->clear();
    // 显式传入完整环境，确保子进程继承 DISPLAY / WAYLAND_DISPLAY 等显示变量
    m_cameraProc->setProcessEnvironment(QProcessEnvironment::systemEnvironment());
    QString script = appBase() + "/python/scan_json.py";
    m_cameraProc->start("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1'").arg(script)});
}

void SettingsDialog::stopCamera()
{
    if (m_cameraProc->state() == QProcess::NotRunning) return;
    QProcess::execute("pkill", {"-SIGINT", "-f", "scan_json.py"});
    QTimer::singleShot(2000, m_cameraProc, [this]() {
        if (m_cameraProc->state() != QProcess::NotRunning) {
            m_cameraProc->terminate();
            QTimer::singleShot(2000, m_cameraProc, [this]() {
                if (m_cameraProc->state() != QProcess::NotRunning)
                    m_cameraProc->kill();
            });
        }
    });
}

void SettingsDialog::onInitReadyRead()
{
    QString out = m_initProc->readAllStandardOutput();
    QString err = m_initProc->readAllStandardError();
    if (!out.isEmpty()) m_initLog->appendPlainText(out.trimmed());
    if (!err.isEmpty()) m_initLog->appendPlainText("[ERR] " + err.trimmed());
}

void SettingsDialog::onInitFinished(int exitCode, QProcess::ExitStatus)
{
    m_initBtn->setEnabled(true);
    if (exitCode == 0) {
        m_initStatus->setText("● 初始化完成");
        m_initStatus->setStyleSheet("color:#1A7F3C; font-weight:bold;");
    } else {
        m_initStatus->setText(QString("● 失败 (exit %1)").arg(exitCode));
        m_initStatus->setStyleSheet("color:#C62828; font-weight:bold;");
    }
}

void SettingsDialog::onCameraReadyRead()
{
    QString out = m_cameraProc->readAllStandardOutput();
    QString err = m_cameraProc->readAllStandardError();
    if (!out.isEmpty()) m_cameraLog->appendPlainText(out.trimmed());
    if (!err.isEmpty()) m_cameraLog->appendPlainText("[ERR] " + err.trimmed());
}

void SettingsDialog::onCameraStateChanged(QProcess::ProcessState state)
{
    switch (state) {
    case QProcess::NotRunning:
        m_cameraStatus->setText("● 未运行");
        m_cameraStatus->setStyleSheet("color:#5A7090; font-weight:bold;");
        m_startCamBtn->setEnabled(true);
        m_stopCamBtn->setEnabled(false);
        break;
    case QProcess::Starting:
        m_cameraStatus->setText("● 启动中");
        m_cameraStatus->setStyleSheet("color:#E65100; font-weight:bold;");
        m_startCamBtn->setEnabled(false);
        m_stopCamBtn->setEnabled(true);
        break;
    case QProcess::Running:
        m_cameraStatus->setText("● 运行中");
        m_cameraStatus->setStyleSheet("color:#1A7F3C; font-weight:bold;");
        m_startCamBtn->setEnabled(false);
        m_stopCamBtn->setEnabled(true);
        break;
    }
}

void SettingsDialog::startDisplay()
{
    if (m_displayProc->state() != QProcess::NotRunning) return;
    m_displayLog->clear();
    m_displayProc->setProcessEnvironment(QProcessEnvironment::systemEnvironment());
    QString script = appBase() + "/python/parcel_display.py";
    m_displayProc->start("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1'").arg(script)});
}

void SettingsDialog::stopDisplay()
{
    if (m_displayProc->state() == QProcess::NotRunning) return;
    QProcess::execute("pkill", {"-SIGINT", "-f", "parcel_display.py"});
    QTimer::singleShot(2000, m_displayProc, [this]() {
        if (m_displayProc->state() != QProcess::NotRunning) {
            m_displayProc->terminate();
            QTimer::singleShot(2000, m_displayProc, [this]() {
                if (m_displayProc->state() != QProcess::NotRunning)
                    m_displayProc->kill();
            });
        }
    });
}

void SettingsDialog::onDisplayReadyRead()
{
    QString out = m_displayProc->readAllStandardOutput();
    QString err = m_displayProc->readAllStandardError();
    if (!out.isEmpty()) m_displayLog->appendPlainText(out.trimmed());
    if (!err.isEmpty()) m_displayLog->appendPlainText("[ERR] " + err.trimmed());
}

void SettingsDialog::onDisplayStateChanged(QProcess::ProcessState state)
{
    switch (state) {
    case QProcess::NotRunning:
        m_displayStatus->setText("● 未运行");
        m_displayStatus->setStyleSheet("color:#5A7090; font-weight:bold;");
        m_startDisplayBtn->setEnabled(true);
        m_stopDisplayBtn->setEnabled(false);
        break;
    case QProcess::Starting:
        m_displayStatus->setText("● 启动中");
        m_displayStatus->setStyleSheet("color:#E65100; font-weight:bold;");
        m_startDisplayBtn->setEnabled(false);
        m_stopDisplayBtn->setEnabled(true);
        break;
    case QProcess::Running:
        m_displayStatus->setText("● 运行中");
        m_displayStatus->setStyleSheet("color:#1A7F3C; font-weight:bold;");
        m_startDisplayBtn->setEnabled(false);
        m_stopDisplayBtn->setEnabled(true);
        break;
    }
}

void SettingsDialog::startPackIn()
{
    if (m_packInProc->state() != QProcess::NotRunning) return;
    m_packInLog->clear();
    m_packInProc->setProcessEnvironment(QProcessEnvironment::systemEnvironment());
    QString script = appBase() + "/python/pack_in.py";
    m_packInProc->start("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1'").arg(script)});
}

void SettingsDialog::stopPackIn()
{
    if (m_packInProc->state() == QProcess::NotRunning) return;
    QProcess::execute("pkill", {"-SIGINT", "-f", "pack_in.py"});
    QTimer::singleShot(2000, m_packInProc, [this]() {
        if (m_packInProc->state() != QProcess::NotRunning) {
            m_packInProc->terminate();
            QTimer::singleShot(2000, m_packInProc, [this]() {
                if (m_packInProc->state() != QProcess::NotRunning)
                    m_packInProc->kill();
            });
        }
    });
}

void SettingsDialog::onPackInReadyRead()
{
    QString out = m_packInProc->readAllStandardOutput();
    QString err = m_packInProc->readAllStandardError();
    if (!out.isEmpty()) m_packInLog->appendPlainText(out.trimmed());
    if (!err.isEmpty()) m_packInLog->appendPlainText("[ERR] " + err.trimmed());
}

void SettingsDialog::onPackInStateChanged(QProcess::ProcessState state)
{
    switch (state) {
    case QProcess::NotRunning:
        m_packInStatus->setText("● 未运行");
        m_packInStatus->setStyleSheet("color:#5A7090; font-weight:bold;");
        m_startPackInBtn->setEnabled(true);
        m_stopPackInBtn->setEnabled(false);
        break;
    case QProcess::Starting:
        m_packInStatus->setText("● 启动中");
        m_packInStatus->setStyleSheet("color:#E65100; font-weight:bold;");
        m_startPackInBtn->setEnabled(false);
        m_stopPackInBtn->setEnabled(true);
        break;
    case QProcess::Running:
        m_packInStatus->setText("● 运行中");
        m_packInStatus->setStyleSheet("color:#1A7F3C; font-weight:bold;");
        m_startPackInBtn->setEnabled(false);
        m_stopPackInBtn->setEnabled(true);
        break;
    }
}
