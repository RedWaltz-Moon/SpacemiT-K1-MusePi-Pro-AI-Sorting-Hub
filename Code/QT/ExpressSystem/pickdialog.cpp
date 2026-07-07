#include "pickdialog.h"
#include "database.h"
#include <QMessageBox>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QGridLayout>
#include <QApplication>
#include <QScreen>
#include <QDebug>
#include <QProcess>
#include <QCoreApplication>

PickDialog::PickDialog(QWidget *parent)
    : QDialog(parent), currentId(-1)
{
    setupUI();
}

PickDialog::~PickDialog() {}

void PickDialog::setupUI()
{
    setWindowTitle("快递取件");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);
    resize(960, 620);
    setMinimumSize(700, 480);

    // 按屏幕分辨率缩放键盘面板
    QScreen *scr = QApplication::primaryScreen();
    const double s = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);
    const int panelW  = qBound(280, qRound(320 * s), 500);
    const int keyMinW = qBound(52,  qRound(60  * s), 120);
    const int keyMinH = qBound(44,  qRound(52  * s), 100);
    const int keyFont = qBound(18,  qRound(24  * s), 40);
    const int dispH   = qBound(48,  qRound(52  * s), 96);
    const int dispFont= qBound(24,  qRound(32  * s), 56);

    // ─── Left panel: keypad ──────────────────────────────────────────
    QWidget *leftPanel = new QWidget(this);
    leftPanel->setAttribute(Qt::WA_StyledBackground, true);
    leftPanel->setObjectName("keypadPanel");
    leftPanel->setFixedWidth(panelW);
    leftPanel->setStyleSheet(
        "QWidget#keypadPanel {"
        "  background: #FFFFFF;"
        "  border: 1px solid #D0DCE8;"
        "  border-radius: 12px;"
        "}"
    );

    QLabel *prompt = new QLabel("请输入手机尾号后 4 位", leftPanel);
    prompt->setAlignment(Qt::AlignCenter);
    prompt->setStyleSheet(
        "background: transparent; color: #5A7090; font-weight: bold;"
    );

    phoneDisplay = new QLabel("○  ○  ○  ○", leftPanel);
    phoneDisplay->setAlignment(Qt::AlignCenter);
    phoneDisplay->setMinimumHeight(dispH);
    phoneDisplay->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    phoneDisplay->setStyleSheet(QString(
        "background: #F5F7FA;"
        "border: 2px solid #0057B8;"
        "border-radius: 8px;"
        "font-size: %1px;"
        "letter-spacing: 8px;"
        "color: #1A2744;"
    ).arg(dispFont));

    auto makeKey = [keyMinW, keyMinH, keyFont](const QString &text, const QString &bg = "digit") -> QPushButton* {
        QPushButton *btn = new QPushButton(text);
        btn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
        btn->setMinimumSize(keyMinW, keyMinH);
        QString style;
        if (bg == "digit") {
            style = QString(
                "QPushButton { background:#FFFFFF; color:#0057B8;"
                "  border:1.5px solid #D0DCE8; border-radius:8px;"
                "  font-size:%1px; font-weight:bold; padding:0; min-width:0; min-height:0; }"
                "QPushButton:hover   { background:#E8F1FB; border-color:#0057B8; }"
                "QPushButton:pressed { background:#DCEEFB; }"
            ).arg(keyFont);
        } else {
            style = QString(
                "QPushButton { background:#F0F4F8; color:#5A7090;"
                "  border:1.5px solid #D0DCE8; border-radius:8px;"
                "  font-size:%1px; font-weight:bold; padding:0; min-width:0; min-height:0; }"
                "QPushButton:hover   { background:#E0E8F0; }"
                "QPushButton:pressed { background:#D0DCE8; }"
            ).arg(keyFont);
        }
        btn->setStyleSheet(style);
        return btn;
    };

    QStringList labels = {"1","2","3","4","5","6","7","8","9","←","0","✕"};
    QStringList bgs    = {"digit","digit","digit",
                          "digit","digit","digit",
                          "digit","digit","digit",
                          "func","digit","func"};

    QGridLayout *grid = new QGridLayout();
    grid->setSpacing(8);
    for (int c = 0; c < 3; ++c) grid->setColumnStretch(c, 1);
    for (int r = 0; r < 4; ++r) grid->setRowStretch(r, 1);
    for (int i = 0; i < 12; ++i) {
        QPushButton *btn = makeKey(labels[i], bgs[i]);
        grid->addWidget(btn, i / 3, i % 3);
        const QString lbl = labels[i];
        if (lbl == "←")
            connect(btn, &QPushButton::clicked, this, &PickDialog::pressBackspace);
        else if (lbl == "✕")
            connect(btn, &QPushButton::clicked, this, &PickDialog::pressClear);
        else
            connect(btn, &QPushButton::clicked, this, [this, lbl]{ pressDigit(lbl); });
    }

    QVBoxLayout *leftLayout = new QVBoxLayout(leftPanel);
    leftLayout->setContentsMargins(18, 20, 18, 20);
    leftLayout->setSpacing(14);
    leftLayout->addWidget(prompt);
    leftLayout->addWidget(phoneDisplay);
    leftLayout->addLayout(grid, 1);

    // ─── Right panel: results ────────────────────────────────────────
    QWidget *rightPanel = new QWidget(this);

    QLabel *resultsTitle = new QLabel("取件列表", rightPanel);
    resultsTitle->setStyleSheet(
        "font-size: 16px; font-weight: bold; color: #0057B8;"
        "padding: 0 0 10px 0; border-bottom: 2px solid #D0DCE8;"
    );

    hintLabel = new QLabel("← 请在左侧键盘输入手机尾号后 4 位", rightPanel);
    hintLabel->setAlignment(Qt::AlignCenter);
    hintLabel->setStyleSheet(
        "color: #8090A0; font-size: 14px;"
        "background: #F5F7FA; border: 1px solid #D0DCE8;"
        "border-radius: 8px; padding: 28px 16px;"
    );

    table = new QTableWidget(rightPanel);
    table->setColumnCount(2);
    table->setHorizontalHeaderLabels({"快递单号", "存放格口"});
    table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    table->setSelectionBehavior(QAbstractItemView::SelectRows);
    table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    table->setAlternatingRowColors(true);
    table->verticalHeader()->setVisible(false);
    table->hide();

    pickBtn = new QPushButton("确认取件", rightPanel);
    pickBtn->setMinimumHeight(52);
    pickBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    pickBtn->setEnabled(false);
    pickBtn->setStyleSheet(
        "QPushButton { background:#0057B8; color:white; border:none;"
        "  border-radius:8px; font-size:18px; font-weight:bold; padding:0; }"
        "QPushButton:hover    { background:#0066D6; }"
        "QPushButton:pressed  { background:#004A9E; }"
        "QPushButton:disabled { background:#C0CDD8; color:#8898A8; }"
    );

    QVBoxLayout *rightLayout = new QVBoxLayout(rightPanel);
    rightLayout->setContentsMargins(0, 0, 0, 0);
    rightLayout->setSpacing(12);
    rightLayout->addWidget(resultsTitle);
    rightLayout->addWidget(hintLabel, 1);
    rightLayout->addWidget(table, 1);
    rightLayout->addWidget(pickBtn);

    // ─── Main layout ─────────────────────────────────────────────────
    QHBoxLayout *mainLayout = new QHBoxLayout(this);
    mainLayout->setContentsMargins(16, 16, 16, 16);
    mainLayout->setSpacing(16);
    mainLayout->addWidget(leftPanel);       // 左侧键盘固定宽度
    mainLayout->addWidget(rightPanel, 1);  // 右侧结果占剩余空间

    connect(pickBtn, &QPushButton::clicked, this, &PickDialog::onPick);
    connect(table, &QTableWidget::itemSelectionChanged, [this]() {
        int row = table->currentRow();
        if (row >= 0) {
            currentId       = table->item(row, 0)->data(Qt::UserRole).toInt();
            currentLocation = table->item(row, 1)->text();
            pickBtn->setEnabled(true);
        } else {
            currentId = -1;
            pickBtn->setEnabled(false);
        }
    });
}

void PickDialog::pressDigit(const QString &d)
{
    if (m_phone.length() >= 4) return;
    m_phone += d;
    updateDisplay();
    if (m_phone.length() == 4)
        doSearch();
}

void PickDialog::pressBackspace()
{
    if (m_phone.isEmpty()) return;
    m_phone.chop(1);
    updateDisplay();
    table->hide();
    table->setRowCount(0);
    hintLabel->setText("← 请在左侧键盘输入手机尾号后 4 位");
    hintLabel->show();
    pickBtn->setEnabled(false);
    currentId = -1;
}

void PickDialog::pressClear()
{
    m_phone.clear();
    updateDisplay();
    table->hide();
    table->setRowCount(0);
    hintLabel->setText("← 请在左侧键盘输入手机尾号后 4 位");
    hintLabel->show();
    pickBtn->setEnabled(false);
    currentId = -1;
}

void PickDialog::updateDisplay()
{
    QString txt;
    for (int i = 0; i < 4; ++i) {
        txt += (i < m_phone.length()) ? "●" : "○";
        if (i < 3) txt += "  ";
    }
    phoneDisplay->setText(txt);
}

void PickDialog::doSearch()
{
    auto list = fetchUnpickedByPhone(m_phone);
    table->setRowCount(0);
    pickBtn->setEnabled(false);
    currentId = -1;

    if (list.isEmpty()) {
        hintLabel->setText(QString("未找到手机尾号 %1 的待取快递").arg(m_phone));
        hintLabel->show();
        table->hide();
        return;
    }

    hintLabel->hide();
    table->show();
    table->setRowCount(list.size());
    for (int i = 0; i < list.size(); ++i) {
        QTableWidgetItem *idItem = new QTableWidgetItem(list[i]["tracking_number"]);
        idItem->setData(Qt::UserRole, list[i]["id"].toInt());
        table->setItem(i, 0, idItem);
        table->setItem(i, 1, new QTableWidgetItem(
            QString("%1 号格口").arg(list[i]["location"])));
    }
}

void PickDialog::onPick()
{
    if (currentId == -1) return;
    if (!markAsPicked(currentId)) {
        QMessageBox::critical(this, "错误", "取件失败，请重试。");
        return;
    }
    controlMotor(currentLocation);
    QMessageBox::information(this, "取件成功",
        QString("取件成功！\n格口位置：%1\n请前往取件，祝您生活愉快。")
        .arg(currentLocation));
    pressClear();
}

void PickDialog::controlMotor(const QString &location)
{
    QString script = QCoreApplication::applicationDirPath() + "/python/motor.py";
    QProcess::startDetached("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1' '%2'")
            .arg(script, location)});
}
