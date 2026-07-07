#include "consultdialog.h"
#include "database.h"
#include <QMessageBox>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QFont>
#include <QApplication>
#include <QScreen>

ConsultDialog::ConsultDialog(QWidget *parent) : QDialog(parent), m_capsLock(true)
{
    setupUI();
}

ConsultDialog::~ConsultDialog() {}

void ConsultDialog::setupUI()
{
    setWindowTitle("快递信息查询");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);
    setMinimumSize(480, 320);
    setWindowState(Qt::WindowMaximized);

    QScreen *scr = QApplication::primaryScreen();
    m_scale = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);
    const double s = m_scale;
    const int barH = qBound(44, qRound(52 * s), 88);
    const int barR = barH / 2;
    const int btnMinW = qBound(88, qRound(100 * s), 180);

    // ─── Search bar ───────────────────────────────────────────────────
    keywordEdit = new QLineEdit(this);
    keywordEdit->setPlaceholderText("输入手机尾号 或 快递单号（支持模糊匹配）");
    keywordEdit->setFixedHeight(barH);
    keywordEdit->setStyleSheet(QString(
        "QLineEdit {"
        "  border: 2px solid #C5D5E8; border-radius: %1px;"
        "  padding: 0 18px; background: white;"
        "}"
        "QLineEdit:focus { border-color: #1976D2; }"
    ).arg(barR));


    // ─── Table ────────────────────────────────────────────────────────
    table = new QTableWidget(this);
    table->setColumnCount(7);
    table->setHorizontalHeaderLabels({
        "ID", "单号", "尾号", "信息", "格口", "时间", "状态"
    });
    table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    table->horizontalHeader()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setMinimumSectionSize(60);
    table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    table->setAlternatingRowColors(true);
    table->verticalHeader()->setVisible(false);
    table->verticalHeader()->setDefaultSectionSize(46);

    // ─── Bottom bar ───────────────────────────────────────────────────
    resultCountLabel = new QLabel("", this);
    resultCountLabel->setStyleSheet("color: #546E7A; font-size: 12px;");

    QPushButton *closeBtn = new QPushButton("关  闭", this);
    closeBtn->setFixedHeight(barH);
    closeBtn->setMinimumWidth(btnMinW);
    closeBtn->setStyleSheet(QString(
        "QPushButton {"
        "  background: #546E7A; color: white; border: none;"
        "  border-radius: %1px; font-weight: bold; padding: 0 24px;"
        "  min-width: 0; min-height: 0;"
        "}"
        "QPushButton:hover   { background: #607D8B; }"
        "QPushButton:pressed { background: #37474F; }"
    ).arg(barR));
    connect(closeBtn, &QPushButton::clicked, this, &QDialog::close);

    QHBoxLayout *bottomRow = new QHBoxLayout();
    bottomRow->addWidget(resultCountLabel);
    bottomRow->addStretch();
    bottomRow->addWidget(closeBtn);

    // ─── Body：键盘(左) + 表格(右) ────────────────────────────────────
    QHBoxLayout *bodyRow = new QHBoxLayout();
    bodyRow->setSpacing(12);
    bodyRow->addWidget(buildKeyboard(), 5);
    bodyRow->addWidget(table, 4);

    // ─── Main layout ──────────────────────────────────────────────────
    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(20, 20, 20, 16);
    mainLayout->setSpacing(12);
    mainLayout->addWidget(keywordEdit);
    mainLayout->addLayout(bodyRow, 1);
    mainLayout->addLayout(bottomRow);

    connect(keywordEdit, &QLineEdit::returnPressed, this, &ConsultDialog::onSearch);
}

void ConsultDialog::onSearch()
{
    QString kw = keywordEdit->text().trimmed();
    if (kw.isEmpty()) {
        QMessageBox::warning(this, "提示", "请输入查询关键词。");
        return;
    }
    performSearch(kw);
}

void ConsultDialog::performSearch(const QString &keyword)
{
    auto results = searchShipments(keyword);
    table->setRowCount(results.size());

    for (int i = 0; i < results.size(); ++i) {
        const auto &r = results[i];
        bool isPending = (r["status"] == "0");

        table->setItem(i, 0, new QTableWidgetItem(r["id"]));
        table->setItem(i, 1, new QTableWidgetItem(r["tracking_number"]));
        table->setItem(i, 2, new QTableWidgetItem(r["phone_last4"]));
        table->setItem(i, 3, new QTableWidgetItem(r["raw_text"]));
        table->setItem(i, 4, new QTableWidgetItem(
            QString("%1 号格口").arg(r["location"])));
        table->setItem(i, 5, new QTableWidgetItem(r["storage_time"]));

        QTableWidgetItem *statusItem = new QTableWidgetItem(isPending ? "  待  取  " : "  已  取  ");
        statusItem->setTextAlignment(Qt::AlignCenter);
        statusItem->setBackground(isPending ? QColor("#E3F2FD") : QColor("#E8F5E9"));
        statusItem->setForeground(isPending ? QColor("#0D47A1") : QColor("#1B5E20"));
        QFont f = statusItem->font();
        f.setBold(true);
        statusItem->setFont(f);
        table->setItem(i, 6, statusItem);
    }

    if (results.isEmpty()) {
        resultCountLabel->setText("未找到相关快递记录");
        QMessageBox::information(this, "提示", "未找到相关快递。");
    } else {
        resultCountLabel->setText(QString("共找到 %1 条记录").arg(results.size()));
    }
}

QWidget *ConsultDialog::buildKeyboard()
{
    const int kbFont = qBound(11, qRound(13 * m_scale), 22);

    // 预计算各类按键样式，避免循环内反复构造长字符串（防 MinGW ICE）
    auto makeStyle = [kbFont](const char *type) -> QString {
        if (strcmp(type, "primary") == 0)
            return QString(
                "QPushButton{background:#FFFFFF;color:#0057B8;"
                "border:1.5px solid #D0DCE8;border-radius:5px;"
                "font-size:%1px;font-weight:bold;padding:0;min-width:0;min-height:0;}"
                "QPushButton:hover{background:#E8F1FB;border-color:#0057B8;}"
                "QPushButton:pressed{background:#DCEEFB;}"
            ).arg(kbFont);
        if (strcmp(type, "func") == 0)
            return QString(
                "QPushButton{background:#F0F4F8;color:#5A7090;"
                "border:1.5px solid #D0DCE8;border-radius:5px;"
                "font-size:%1px;font-weight:bold;padding:0;min-width:0;min-height:0;}"
                "QPushButton:hover{background:#E0E8F0;}"
                "QPushButton:pressed{background:#D0DCE8;}"
            ).arg(kbFont);
        // action
        return QString(
            "QPushButton{background:#0057B8;color:white;"
            "border:none;border-radius:5px;"
            "font-size:%1px;font-weight:bold;padding:0;min-width:0;min-height:0;}"
            "QPushButton:hover{background:#0066D6;}"
            "QPushButton:pressed{background:#004A9E;}"
        ).arg(kbFont);
    };
    const QString sNum  = makeStyle("primary");
    const QString sChar = makeStyle("primary");
    const QString sBS   = makeStyle("func");
    const QString sCLR  = makeStyle("func");
    const QString sSrch = makeStyle("action");

    QWidget *kb = new QWidget(this);
    QGridLayout *grid = new QGridLayout(kb);
    grid->setSpacing(6);
    grid->setContentsMargins(0, 0, 0, 0);
    for (int c = 0; c < 10; ++c) grid->setColumnStretch(c, 1);
    for (int r = 0; r < 4;  ++r) grid->setRowStretch(r, 1);

    auto addKey = [&](int row, int col, const QString &label,
                      const QString &val, const QString &style) {
        QPushButton *btn = new QPushButton(label, kb);
        btn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
        btn->setProperty("keyVal", val);
        btn->setStyleSheet(style);
        connect(btn, &QPushButton::clicked, this, &ConsultDialog::onKeyPressed);
        grid->addWidget(btn, row, col);
    };

    // 第 0 行：数字
    const char *nums[10] = {"1","2","3","4","5","6","7","8","9","0"};
    for (int c = 0; c < 10; ++c) addKey(0, c, nums[c], nums[c], sNum);

    // 第 1 行：大/小(大小写) + QWERTYUIO，共 10 格（P 移至第 2 行）
    m_capsBtn = new QPushButton("大", kb);
    m_capsBtn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_capsBtn->setProperty("keyVal", "CAPS");
    m_capsBtn->setStyleSheet(sChar);
    connect(m_capsBtn, &QPushButton::clicked, this, &ConsultDialog::onKeyPressed);
    grid->addWidget(m_capsBtn, 1, 0);

    const char *r1[9] = {"Q","W","E","R","T","Y","U","I","O"};
    for (int c = 0; c < 9; ++c) addKey(1, c + 1, r1[c], r1[c], sChar);

    // 第 2 行：PASDFGHJKL，共 10 格
    const char *r2[10] = {"P","A","S","D","F","G","H","J","K","L"};
    for (int c = 0; c < 10; ++c) addKey(2, c, r2[c], r2[c], sChar);

    // 第 3 行：ZXCVBNM + ← + X(清空) + 查询
    const char *r3[7] = {"Z","X","C","V","B","N","M"};
    for (int c = 0; c < 7; ++c) addKey(3, c, r3[c], r3[c], sChar);
    addKey(3, 7, "←",  "BS",     sBS);
    addKey(3, 8, "✕",  "CLR",   sCLR);
    addKey(3, 9, "查询", "SEARCH", sSrch);

    return kb;
}

void ConsultDialog::onKeyPressed()
{
    QPushButton *btn = qobject_cast<QPushButton*>(sender());
    if (!btn) return;
    const QString val = btn->property("keyVal").toString();
    if      (val == "BS")     keywordEdit->backspace();
    else if (val == "CLR")    keywordEdit->clear();
    else if (val == "SEARCH") onSearch();
    else if (val == "CAPS") {
        m_capsLock = !m_capsLock;
        const int f = qBound(11, qRound(13 * m_scale), 22);
        const QString msActive = QString(
            "QPushButton{background:#0057B8;color:white;"
            "border:1.5px solid #0057B8;border-radius:5px;"
            "font-size:%1px;font-weight:bold;padding:0;min-width:0;min-height:0;}"
            "QPushButton:hover{background:#0066D6;}"
            "QPushButton:pressed{background:#004A9E;}"
        ).arg(f);
        const QString msInactive = QString(
            "QPushButton{background:#F0F4F8;color:#5A7090;"
            "border:1.5px solid #D0DCE8;border-radius:5px;"
            "font-size:%1px;font-weight:bold;padding:0;min-width:0;min-height:0;}"
            "QPushButton:hover{background:#E0E8F0;}"
            "QPushButton:pressed{background:#D0DCE8;}"
        ).arg(f);
        m_capsBtn->setText(m_capsLock ? "大" : "小");
        m_capsBtn->setStyleSheet(m_capsLock ? msActive : msInactive);
        for (QPushButton *b : findChildren<QPushButton*>()) {
            const QString v = b->property("keyVal").toString();
            if (v.length() == 1 && v[0].isLetter())
                b->setText(m_capsLock ? v.toUpper() : v.toLower());
        }
    } else {
        keywordEdit->insert(m_capsLock ? val : val.toLower());
    }
}
