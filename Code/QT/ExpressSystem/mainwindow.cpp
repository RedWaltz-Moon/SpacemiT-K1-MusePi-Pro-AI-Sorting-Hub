#include "mainwindow.h"
#include "pickdialog.h"
#include "consultdialog.h"
#include "chatdialog.h"
#include "ollamachatdialog.h"
#include "admindialog.h"
#include "pindialog.h"
#include "settingsdialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFrame>
#include <QLabel>
#include <QMessageBox>
#include <QDateTime>
#include <QStatusBar>
#include <QApplication>
#include <QScreen>
#include <QProcess>
#include <QCoreApplication>

void MainWindow::setupHeader(QWidget *central, double s)
{
    Q_UNUSED(s)

    QWidget *header = new QWidget(central);
    header->setObjectName("header");
    header->setAttribute(Qt::WA_StyledBackground, true);
    header->setMinimumHeight(56);
    header->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);

    QHBoxLayout *headerLayout = new QHBoxLayout(header);
    headerLayout->setContentsMargins(28, 0, 20, 0);
    headerLayout->setSpacing(0);

    QWidget *titleWrap = new QWidget(header);
    titleWrap->setAttribute(Qt::WA_TranslucentBackground);
    QVBoxLayout *titleVBox = new QVBoxLayout(titleWrap);
    titleVBox->setContentsMargins(0, 0, 0, 0);
    titleVBox->setSpacing(3);

    QLabel *titleLabel = new QLabel("快递智能取件系统", titleWrap);
    titleLabel->setObjectName("titleLabel");
    QLabel *subLabel = new QLabel("SMART EXPRESS LOCKER SYSTEM", titleWrap);
    subLabel->setObjectName("subTitleLabel");
    titleVBox->addWidget(titleLabel);
    titleVBox->addWidget(subLabel);

    QLabel *statusLabel = new QLabel("● 系统就绪", header);
    statusLabel->setObjectName("statusLabel");

    clockLabel = new QLabel(header);
    clockLabel->setObjectName("clockLabel");

    settingsBtn = new QPushButton("设  置", header);
    settingsBtn->setObjectName("adminBtn");

    adminBtn = new QPushButton("管 理 员", header);
    adminBtn->setObjectName("adminBtn");

    headerLayout->addWidget(titleWrap);
    headerLayout->addStretch();
    headerLayout->addWidget(statusLabel);
    headerLayout->addSpacing(24);
    headerLayout->addWidget(clockLabel);
    headerLayout->addSpacing(24);
    headerLayout->addWidget(settingsBtn);
    headerLayout->addSpacing(12);
    headerLayout->addWidget(adminBtn);

    QVBoxLayout *mainLayout = static_cast<QVBoxLayout *>(central->layout());
    QFrame *divider = new QFrame(central);
    divider->setFixedHeight(1);
    divider->setStyleSheet("background: #D0DCE8;");
    mainLayout->addWidget(header);
    mainLayout->addWidget(divider);
}

void MainWindow::setupButtons(QWidget *central, double s)
{
    const int btnH  = qBound(70, qRound(100 * s), 160);
    const int gap   = qBound(10, qRound(14  * s), 24);

    const QString subStyle = QString("color: #5A7090; font-size: %1px;")
        .arg(qBound(10, qRound(12 * s), 18));

    // 左列：快递取件（上） + 信息查询（下）
    pickBtn = new QPushButton("快递取件", central);
    pickBtn->setObjectName("mainBtn");
    pickBtn->setFixedHeight(btnH);
    pickBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    consultBtn = new QPushButton("信息查询", central);
    consultBtn->setObjectName("mainBtn");
    consultBtn->setFixedHeight(btnH);
    consultBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    QLabel *pickSub    = new QLabel("凭手机尾号自助取件", central);
    QLabel *consultSub = new QLabel("查询快递单状态信息", central);
    pickSub->setAlignment(Qt::AlignHCenter);
    consultSub->setAlignment(Qt::AlignHCenter);
    pickSub->setStyleSheet(subStyle);
    consultSub->setStyleSheet(subStyle);

    QVBoxLayout *leftWrap = new QVBoxLayout();
    leftWrap->setSpacing(0);
    leftWrap->addStretch(1);
    leftWrap->addWidget(pickBtn);
    leftWrap->addSpacing(6);
    leftWrap->addWidget(pickSub);
    leftWrap->addSpacing(gap);
    leftWrap->addWidget(consultBtn);
    leftWrap->addSpacing(6);
    leftWrap->addWidget(consultSub);
    leftWrap->addStretch(1);

    // 右列：AI助手（上） + 本地AI（下）
    chatBtn = new QPushButton("AI 助手", central);
    chatBtn->setObjectName("chatBtn");
    chatBtn->setFixedHeight(btnH);
    chatBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    localAiBtn = new QPushButton("本地 AI", central);
    localAiBtn->setObjectName("localAiBtn");
    localAiBtn->setFixedHeight(btnH);
    localAiBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    QLabel *chatSub    = new QLabel("AI 智能取件助手", central);
    QLabel *localAiSub = new QLabel("本地模型自由对话", central);
    chatSub->setAlignment(Qt::AlignHCenter);
    localAiSub->setAlignment(Qt::AlignHCenter);
    chatSub->setStyleSheet(subStyle);
    localAiSub->setStyleSheet(subStyle);

    QVBoxLayout *rightWrap = new QVBoxLayout();
    rightWrap->setSpacing(0);
    rightWrap->addStretch(1);
    rightWrap->addWidget(chatBtn);
    rightWrap->addSpacing(6);
    rightWrap->addWidget(chatSub);
    rightWrap->addSpacing(gap);
    rightWrap->addWidget(localAiBtn);
    rightWrap->addSpacing(6);
    rightWrap->addWidget(localAiSub);
    rightWrap->addStretch(1);

    QHBoxLayout *btnRow = new QHBoxLayout();
    btnRow->setSpacing(16);
    btnRow->addLayout(leftWrap, 1);
    btnRow->addLayout(rightWrap, 1);

    QHBoxLayout *centerWrap = new QHBoxLayout();
    centerWrap->setContentsMargins(32, 0, 32, 0);
    centerWrap->addLayout(btnRow);

    QVBoxLayout *mainLayout = static_cast<QVBoxLayout *>(central->layout());
    mainLayout->addStretch(1);
    mainLayout->addLayout(centerWrap, 3);
    mainLayout->addStretch(1);
}

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setWindowTitle("快递智能取件系统");
    setMinimumSize(480, 320);

    QWidget *central = new QWidget(this);
    setCentralWidget(central);

    QVBoxLayout *mainLayout = new QVBoxLayout(central);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    QScreen *scr = QApplication::primaryScreen();
    const double s = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);

    setupHeader(central, s);
    setupButtons(central, s);

    statusBar()->showMessage(
        "  ● 数据库已连接    服务器: 121.40.169.218    "
        + QDateTime::currentDateTime().toString("yyyy/MM/dd")
    );

    m_settingsDlg = new SettingsDialog(this);
    m_chatDlg     = new ChatDialog(this);
    m_localAiDlg  = new OllamaChatDialog(this);

    connect(pickBtn,     &QPushButton::clicked, this, &MainWindow::openPickDialog);
    connect(consultBtn,  &QPushButton::clicked, this, &MainWindow::openConsultDialog);
    connect(chatBtn,     &QPushButton::clicked, this, &MainWindow::openChatDialog);
    connect(localAiBtn,  &QPushButton::clicked, this, &MainWindow::openLocalAiDialog);
    connect(adminBtn,    &QPushButton::clicked, this, &MainWindow::openAdminDialog);
    connect(settingsBtn, &QPushButton::clicked, this, &MainWindow::openSettingsDialog);

    clockTimer = new QTimer(this);
    connect(clockTimer, &QTimer::timeout, this, &MainWindow::updateClock);
    clockTimer->start(1000);
    updateClock();

    QString poller = QCoreApplication::applicationDirPath() + "/python/pickup_poller.py";
    QProcess::startDetached("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1'").arg(poller)});
}

MainWindow::~MainWindow() {}

void MainWindow::updateClock()
{
    clockLabel->setText(QDateTime::currentDateTime().toString("yyyy/MM/dd  HH:mm:ss"));
}

void MainWindow::openPickDialog()
{
    PickDialog dlg(this);
    dlg.exec();
}

void MainWindow::openConsultDialog()
{
    ConsultDialog dlg(this);
    dlg.exec();
}

void MainWindow::openChatDialog()
{
    m_chatDlg->showNormal();
    m_chatDlg->raise();
    m_chatDlg->activateWindow();
}

void MainWindow::openLocalAiDialog()
{
    m_localAiDlg->showNormal();
    m_localAiDlg->raise();
    m_localAiDlg->activateWindow();
}

void MainWindow::openSettingsDialog()
{
    m_settingsDlg->show();
    m_settingsDlg->raise();
    m_settingsDlg->activateWindow();
}

void MainWindow::openAdminDialog()
{
    static const QString ADMIN_CODE = "123456";

    PinDialog pin(this);
    if (pin.exec() != QDialog::Accepted) return;

    if (pin.code() != ADMIN_CODE) {
        QMessageBox::warning(this, "验证失败", "验证码错误，拒绝访问。");
        return;
    }

    AdminDialog dlg(this);
    dlg.exec();
}
