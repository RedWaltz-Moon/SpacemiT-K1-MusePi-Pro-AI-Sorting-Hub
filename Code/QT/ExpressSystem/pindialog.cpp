#include "pindialog.h"
#include <QGridLayout>
#include <QVBoxLayout>
#include <QPushButton>
#include <QApplication>
#include <QScreen>

PinDialog::PinDialog(QWidget *parent) : QDialog(parent)
{
    setupUI();
}

void PinDialog::setupUI()
{
    setWindowTitle("管理员验证");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);

    QScreen *scr = QApplication::primaryScreen();
    const double s = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);
    const int dlgW    = qBound(300, qRound(340 * s), 600);
    const int dlgH    = qBound(440, qRound(500 * s), 900);
    const int btnMinW = qBound(48,  qRound(56  * s), 120);
    const int btnMinH = qBound(38,  qRound(44  * s), 90);
    const int btnFont = qBound(16,  qRound(22  * s), 42);
    const int dispH   = qBound(48,  qRound(56  * s), 108);
    const int dispFont= qBound(22,  qRound(30  * s), 58);

    resize(dlgW, dlgH);

    display = new QLabel("请输入验证码", this);
    display->setAlignment(Qt::AlignCenter);
    display->setMinimumHeight(dispH);
    display->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Preferred);
    display->setStyleSheet(QString(
        "background: #F5F7FA;"
        "border: 2px solid #0057B8;"
        "border-radius: 8px;"
        "font-size: %1px;"
        "letter-spacing: 10px;"
        "color: #1A2744;"
    ).arg(dispFont));

    auto makeBtn = [btnMinW, btnMinH, btnFont](const QString &text, const QString &type = "digit") {
        QPushButton *btn = new QPushButton(text);
        btn->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
        btn->setMinimumSize(btnMinW, btnMinH);
        QString style;
        if (type == "digit") {
            style = QString(
                "QPushButton { background:#FFFFFF; color:#0057B8;"
                "  border:1.5px solid #D0DCE8; border-radius:8px;"
                "  font-size:%1px; font-weight:bold; padding:0; min-width:0; min-height:0; }"
                "QPushButton:hover   { background:#E8F1FB; border-color:#0057B8; }"
                "QPushButton:pressed { background:#DCEEFB; }"
            ).arg(btnFont);
        } else if (type == "func") {
            style = QString(
                "QPushButton { background:#F0F4F8; color:#5A7090;"
                "  border:1.5px solid #D0DCE8; border-radius:8px;"
                "  font-size:%1px; font-weight:bold; padding:0; min-width:0; min-height:0; }"
                "QPushButton:hover   { background:#E0E8F0; }"
                "QPushButton:pressed { background:#D0DCE8; }"
            ).arg(btnFont);
        } else {
            style = QString(
                "QPushButton { background:#0057B8; color:white; border:none;"
                "  border-radius:8px; font-size:%1px; font-weight:bold;"
                "  padding:0; min-width:0; min-height:0; }"
                "QPushButton:hover   { background:#0066D6; }"
                "QPushButton:pressed { background:#004A9E; }"
            ).arg(btnFont);
        }
        btn->setStyleSheet(style);
        return btn;
    };

    QGridLayout *grid = new QGridLayout();
    grid->setSpacing(10);
    for (int c = 0; c < 3; ++c) grid->setColumnStretch(c, 1);
    for (int r = 0; r < 4; ++r) grid->setRowStretch(r, 1);

    QString digits[12] = {"1","2","3","4","5","6","7","8","9","←","0","✓"};
    for (int i = 0; i < 12; ++i) {
        QString d = digits[i];
        QPushButton *btn;
        if (d == "←")
            btn = makeBtn(d, "func");
        else if (d == "✓")
            btn = makeBtn(d, "confirm");
        else
            btn = makeBtn(d, "digit");

        grid->addWidget(btn, i / 3, i % 3);

        if (d == "←")
            connect(btn, &QPushButton::clicked, this, &PinDialog::pressBackspace);
        else if (d == "✓")
            connect(btn, &QPushButton::clicked, this, &PinDialog::pressConfirm);
        else
            connect(btn, &QPushButton::clicked, this, [this, d]() { pressDigit(d); });
    }

    QVBoxLayout *main = new QVBoxLayout(this);
    main->setContentsMargins(24, 24, 24, 24);
    main->setSpacing(16);
    main->addWidget(display);
    main->addLayout(grid, 1);
}

void PinDialog::pressDigit(const QString &d)
{
    if (m_code.length() < 6)
        m_code += d;
    updateDisplay();
}

void PinDialog::pressBackspace()
{
    if (!m_code.isEmpty())
        m_code.chop(1);
    updateDisplay();
}

void PinDialog::pressConfirm()
{
    if (m_code.length() == 6)
        accept();
}

void PinDialog::updateDisplay()
{
    if (m_code.isEmpty()) {
        display->setText("请输入验证码");
        display->setStyleSheet(display->styleSheet());
        return;
    }
    display->setText(QString("●").repeated(m_code.length())
                     + QString("○").repeated(6 - m_code.length()));
}
