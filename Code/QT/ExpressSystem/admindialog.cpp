#include "admindialog.h"
#include "database.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QPushButton>
#include <QMessageBox>
#include <QFont>
#include <QDebug>
#include <QApplication>
#include <QScreen>
#include <QProcess>
#include <QCoreApplication>

AdminDialog::AdminDialog(QWidget *parent) : QDialog(parent)
{
    QScreen *scr = QApplication::primaryScreen();
    m_scale = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);
    setupUI();
    refreshTimer = new QTimer(this);
    connect(refreshTimer, &QTimer::timeout, this, &AdminDialog::refreshTable);
    refreshTimer->start(3000);
    refreshTable();
}

AdminDialog::~AdminDialog()
{
    refreshTimer->stop();
}

void AdminDialog::setupUI()
{
    setWindowTitle("管理员 — 全部快递记录");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);
    setMinimumSize(480, 320);
    setWindowState(Qt::WindowMaximized);

    // ─── Stats bar ────────────────────────────────────────────────────
    statsLabel = new QLabel(this);
    statsLabel->setMinimumHeight(52);
    statsLabel->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    statsLabel->setAlignment(Qt::AlignVCenter | Qt::AlignLeft);
    statsLabel->setStyleSheet(
        "background: #E8F1FB;"
        "color: #0057B8;"
        "font-weight: bold;"
        "padding: 0 16px;"
        "border: 1px solid #D0DCE8;"
        "border-radius: 6px;"
    );

    // ─── Table ────────────────────────────────────────────────────────
    table = new QTableWidget(this);
    table->setColumnCount(8);
    table->setHorizontalHeaderLabels({
        "ID", "快递单号", "手机尾号", "商品信息",
        "存放格口", "入库时间", "状态", "操作"
    });
    table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    table->horizontalHeader()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    table->horizontalHeader()->setSectionResizeMode(7, QHeaderView::Fixed);
    table->setColumnWidth(7, qRound(88 * m_scale));
    table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    table->setSelectionBehavior(QAbstractItemView::SelectRows);
    table->setAlternatingRowColors(true);
    table->verticalHeader()->setVisible(false);
    table->setShowGrid(true);

    // ─── Bottom bar ───────────────────────────────────────────────────
    QLabel *refreshHint = new QLabel("● 每 3 秒自动刷新", this);
    refreshHint->setStyleSheet("color: #5A7090;");

    QPushButton *closeBtn = new QPushButton("关  闭", this);
    const int closeBtnH = qBound(36, qRound(44 * m_scale), 80);
    closeBtn->setFixedHeight(closeBtnH);
    closeBtn->setStyleSheet(QString(
        "QPushButton { background:#546E7A; color:white; border:none;"
        "  border-radius:%1px; font-weight:bold; padding:0 20px; min-width:0; min-height:0; }"
        "QPushButton:hover   { background:#607D8B; }"
        "QPushButton:pressed { background:#37474F; }"
    ).arg(closeBtnH / 2));
    connect(closeBtn, &QPushButton::clicked, this, &QDialog::close);

    QHBoxLayout *bottomLayout = new QHBoxLayout();
    bottomLayout->addWidget(refreshHint);
    bottomLayout->addStretch();
    bottomLayout->addWidget(closeBtn);

    // ─── Main layout ──────────────────────────────────────────────────
    QVBoxLayout *layout = new QVBoxLayout(this);
    layout->setContentsMargins(16, 16, 16, 16);
    layout->setSpacing(10);
    layout->addWidget(statsLabel);
    layout->addWidget(table);
    layout->addLayout(bottomLayout);
}

void AdminDialog::populateRow(int i, const QMap<QString, QString> &row)
{
    bool isPending = (row["status"] == "0");

    table->setItem(i, 0, new QTableWidgetItem(row["id"]));
    table->setItem(i, 1, new QTableWidgetItem(row["tracking_number"]));
    table->setItem(i, 2, new QTableWidgetItem(row["phone_last4"]));
    table->setItem(i, 3, new QTableWidgetItem(row["raw_text"]));
    table->setItem(i, 4, new QTableWidgetItem(QString("%1 号").arg(row["location"])));
    table->setItem(i, 5, new QTableWidgetItem(row["storage_time"]));

    QTableWidgetItem *statusItem = new QTableWidgetItem(isPending ? "  待  取  " : "  已  取  ");
    statusItem->setTextAlignment(Qt::AlignCenter);
    statusItem->setBackground(isPending ? QColor("#E3F2FD") : QColor("#E8F5E9"));
    statusItem->setForeground(isPending ? QColor("#0D47A1") : QColor("#1B5E20"));
    QFont f = statusItem->font();
    f.setBold(true);
    statusItem->setFont(f);
    table->setItem(i, 6, statusItem);

    const int actW    = qBound(60,  qRound(80  * m_scale), 150);
    const int actH    = qBound(26,  qRound(34  * m_scale), 64);
    const int actFont = qBound(11,  qRound(13  * m_scale), 24);
    const int actRad  = qBound(3,   qRound(4   * m_scale), 8);

    QString pickStyle = QString(
        "QPushButton { background:#0057B8; color:white; border:none;"
        "  border-radius:%1px; font-size:%2px; font-weight:bold;"
        "  padding:0; min-width:0; min-height:0; }"
        "QPushButton:hover   { background:#0066D6; }"
        "QPushButton:pressed { background:#004A9E; }"
    ).arg(actRad).arg(actFont);
    QString unpickStyle = QString(
        "QPushButton { background:#FFFFFF; color:#D84315; border:1.5px solid #FFCCBC;"
        "  border-radius:%1px; font-size:%2px; font-weight:bold;"
        "  padding:0; min-width:0; min-height:0; }"
        "QPushButton:hover   { background:#FFF3E0; }"
        "QPushButton:pressed { background:#FFE0B2; }"
    ).arg(actRad).arg(actFont);

    QPushButton *actionBtn = new QPushButton(isPending ? "取件" : "撤回");
    actionBtn->setFixedSize(actW, actH);
    actionBtn->setStyleSheet(isPending ? pickStyle : unpickStyle);
    if (isPending)
        connect(actionBtn, &QPushButton::clicked, [this, i]() { onPickForRow(i); });
    else
        connect(actionBtn, &QPushButton::clicked, [this, i]() { onUnpickForRow(i); });
    table->setCellWidget(i, 7, actionBtn);
}

void AdminDialog::refreshTable()
{
    auto data = fetchAllShipments();

    int pending = 0, picked = 0;
    for (const auto &row : data)
        row["status"] == "0" ? ++pending : ++picked;

    statsLabel->setText(
        QString("  共  %1  件       待取  %2  件       已取  %3  件       格口占用  %4 / 6")
        .arg(data.size()).arg(pending).arg(picked).arg(pending)
    );

    table->setRowCount(data.size());
    for (int i = 0; i < data.size(); ++i)
        populateRow(i, data[i]);
}

void AdminDialog::onPickForRow(int row)
{
    int id           = table->item(row, 0)->text().toInt();
    QString location = table->item(row, 4)->text();
    if (markAsPicked(id)) {
        controlMotor(location);
        QMessageBox::information(this, "取件成功",
            QString("已发送取件指令\n格口位置：%1").arg(location));
        refreshTable();
    } else {
        QMessageBox::critical(this, "错误", "取件失败，请重试。");
    }
}

void AdminDialog::onUnpickForRow(int row)
{
    int id           = table->item(row, 0)->text().toInt();
    QString tracking = table->item(row, 1)->text();
    auto ret = QMessageBox::question(this, "确认撤回",
        QString("确认将快递\n%1\n撤回为待取状态？").arg(tracking),
        QMessageBox::Yes | QMessageBox::No);
    if (ret != QMessageBox::Yes) return;

    if (unmarkAsPicked(id)) {
        QMessageBox::information(this, "撤回成功", "已恢复为待取状态。");
        refreshTable();
    } else {
        QMessageBox::critical(this, "错误", "撤回失败，请重试。");
    }
}

void AdminDialog::controlMotor(const QString &location)
{
    QString script = QCoreApplication::applicationDirPath() + "/python/motor.py";
    QString cmd    = QString("source ~/demo_env/bin/activate && python3 '%1' '%2'")
                     .arg(script, location);
    QProcess::startDetached("bash", {"-c", cmd});
}
