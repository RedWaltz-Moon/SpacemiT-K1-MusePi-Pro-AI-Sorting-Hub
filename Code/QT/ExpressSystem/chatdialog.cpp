#include "chatdialog.h"
#include "database.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QApplication>
#include <QScreen>
#include <QProcess>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QRegularExpression>
#include <QScrollBar>
#include <QCoreApplication>
#include <QDebug>

static QString systemPrompt()
{
    return
        "你是快递取件柜的AI助手。"
        "当用户提供手机尾号时，根据提供的包裹数据帮助一次性取出所有包裹。"
        "必须严格以纯JSON格式回复，不要加任何其他文字，格式如下：\n"
        "{\"message\":\"回复内容\","
        "\"actions\":[{\"locker\":\"格口位置\",\"package_id\":ID数字}, ...]}\n"
        "有多少个包裹就在actions数组里放多少项，没有包裹时actions为空数组[]。";
}

ChatDialog::ChatDialog(QWidget *parent) : QDialog(parent)
{
    QScreen *scr = QApplication::primaryScreen();
    m_scale = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);

    m_proc = new QProcess(this);
    connect(m_proc, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, &ChatDialog::onProcessFinished);

    setupUI();
}

void ChatDialog::setupUI()
{
    setWindowTitle("AI 取件助手");
    setWindowFlags(windowFlags() & ~Qt::WindowContextHelpButtonHint);
    setMinimumSize(360, 440);
    resize(qRound(460 * m_scale), qRound(540 * m_scale));

    m_chat = new QTextBrowser(this);
    m_chat->setOpenLinks(false);
    m_chat->setStyleSheet(
        "QTextBrowser { background:#F5F7FA; border:1px solid #D0DCE8;"
        "  border-radius:6px; padding:8px; color:#1A2744; }"
    );

    const int inputH = qBound(32, qRound(40 * m_scale), 60);

    m_input = new QLineEdit(this);
    m_input->setPlaceholderText("输入消息，如：手机尾号 1234 帮我取件");
    m_input->setFixedHeight(inputH);
    m_input->setStyleSheet(
        "QLineEdit { background:white; border:1.5px solid #D0DCE8;"
        "  border-radius:4px; color:#1A2744; padding:0 8px; }"
        "QLineEdit:focus { border-color:#0057B8; }"
    );

    m_sendBtn = new QPushButton("发 送", this);
    m_sendBtn->setFixedHeight(inputH);
    m_sendBtn->setStyleSheet(
        "QPushButton { background:#0057B8; color:white; border:none;"
        "  border-radius:4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:#0066D6; }"
        "QPushButton:pressed  { background:#004A9E; }"
        "QPushButton:disabled { background:#C0CDD8; color:#8898A8; }"
    );

    m_statusLabel = new QLabel("● 就绪", this);
    m_statusLabel->setStyleSheet("color:#5A7090; font-size:11px;");

    QHBoxLayout *inputRow = new QHBoxLayout();
    inputRow->setSpacing(8);
    inputRow->addWidget(m_input);
    inputRow->addWidget(m_sendBtn);

    QVBoxLayout *layout = new QVBoxLayout(this);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->setSpacing(8);
    layout->addWidget(m_chat);
    layout->addWidget(m_statusLabel);
    layout->addLayout(inputRow);

    connect(m_sendBtn,  &QPushButton::clicked,      this, &ChatDialog::sendMessage);
    connect(m_input,    &QLineEdit::returnPressed,   this, &ChatDialog::sendMessage);

    appendBubble("你好！请告诉我您的手机尾号，我来帮您查询并开取格口。", false);
}

void ChatDialog::appendBubble(const QString &text, bool isUser)
{
    const QString bg     = isUser ? "#0057B8" : "#FFFFFF";
    const QString color  = isUser ? "#FFFFFF"  : "#1A2744";
    const QString border = isUser ? "none"     : "1px solid #D0DCE8";
    const QString align  = isUser ? "right"    : "left";
    const QString margin = isUser ? "margin:4px 0 4px 60px" : "margin:4px 60px 4px 0";

    QString html = QString(
        "<div style='text-align:%1; %2;'>"
        "<span style='background:%3; color:%4; border:%5; border-radius:8px;"
        "  padding:6px 10px; display:inline-block;'>"
        "%6</span></div>"
    ).arg(align, margin, bg, color, border, text.toHtmlEscaped());

    m_chat->append(html);
    m_chat->verticalScrollBar()->setValue(m_chat->verticalScrollBar()->maximum());
}

QString ChatDialog::buildMessage(const QString &userMsg)
{
    QString context;

    QRegularExpression re("\\b(\\d{4})\\b");
    QRegularExpressionMatch m = re.match(userMsg);
    if (m.hasMatch()) {
        QString phone = m.captured(1);
        auto pkgs = fetchUnpickedByPhone(phone);
        if (pkgs.isEmpty()) {
            context = QString("\n（系统查询：手机尾号%1无待取包裹）").arg(phone);
        } else {
            context = QString("\n（系统查询：手机尾号%1的待取包裹：").arg(phone);
            for (const auto &p : pkgs) {
                context += QString(" ID:%1 单号:%2 格口:%3 商品:%4;")
                    .arg(p["id"], p["tracking_number"], p["location"], p["category_name"]);
            }
            context += "）";
        }
    }

    return systemPrompt() + "\n\n用户消息：" + userMsg + context;
}

void ChatDialog::sendMessage()
{
    if (m_proc->state() != QProcess::NotRunning) {
        m_proc->kill();
        appendBubble("（已取消）", false);
        return;
    }

    const QString text = m_input->text().trimmed();
    if (text.isEmpty()) return;

    m_input->clear();
    m_sendBtn->setText("取 消");
    m_sendBtn->setStyleSheet(
        "QPushButton { background:#C62828; color:white; border:none;"
        "  border-radius:4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:#E53935; }"
        "QPushButton:pressed  { background:#B71C1C; }"
    );
    m_statusLabel->setText("● 请求中…");
    m_statusLabel->setStyleSheet("color:#E65100; font-size:11px;");
    appendBubble(text, true);

    m_proc->start("openclaw", {"agent", "--session-id", "express-pickup", "--message", buildMessage(text), "--json", "--timeout", "30"});
}

void ChatDialog::handleAgentResponse(const QString &rawBody)
{
    // openclaw --json format: { "payloads": [{ "text": "...", ... }], "meta": {...} }
    // stdout may contain plugin log lines before the JSON — skip to first '{'
    QString agentText;
    int jsonStart = rawBody.indexOf('{');
    if (jsonStart >= 0) {
        QJsonDocument envelope = QJsonDocument::fromJson(rawBody.mid(jsonStart).toUtf8());
        if (!envelope.isNull() && envelope.isObject()) {
            QJsonArray payloads = envelope.object()["payloads"].toArray();
            if (!payloads.isEmpty())
                agentText = payloads[0].toObject()["text"].toString().trimmed();
        }
    }
    if (agentText.isEmpty()) {
        appendBubble("（无法解析响应）", false);
        return;
    }

    // Strip markdown code fences if AI wrapped response
    if (agentText.startsWith("```")) {
        agentText.remove(QRegularExpression("^```[a-z]*\\n?"));
        agentText.remove(QRegularExpression("\\n?```$"));
        agentText = agentText.trimmed();
    }

    // Try to parse as structured action JSON
    QJsonDocument inner = QJsonDocument::fromJson(agentText.toUtf8());
    if (!inner.isNull() && inner.isObject()) {
        QJsonObject r = inner.object();
        appendBubble(r["message"].toString(), false);
        for (const QJsonValue &v : r["actions"].toArray()) {
            QJsonObject act = v.toObject();
            processAction(act["locker"].toString(), act["package_id"].toInt());
        }
    } else {
        appendBubble(agentText, false);
    }
}

void ChatDialog::onProcessFinished(int exitCode, QProcess::ExitStatus status)
{
    m_sendBtn->setText("发 送");
    m_sendBtn->setStyleSheet(
        "QPushButton { background:#0057B8; color:white; border:none;"
        "  border-radius:4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:#0066D6; }"
        "QPushButton:pressed  { background:#004A9E; }"
        "QPushButton:disabled { background:#C0CDD8; color:#8898A8; }"
    );
    m_statusLabel->setText("● 就绪");
    m_statusLabel->setStyleSheet("color:#5A7090; font-size:11px;");

    if (status == QProcess::CrashExit) return; // 用户主动取消，气泡已追加

    if (exitCode != 0) {
        QString err = QString::fromUtf8(m_proc->readAllStandardError()).trimmed();
        appendBubble("错误：" + (err.isEmpty() ? QString("exit %1").arg(exitCode) : err.split('\n').last()), false);
        return;
    }

    handleAgentResponse(QString::fromUtf8(m_proc->readAllStandardOutput()));
}

void ChatDialog::processAction(const QString &locker, int pkgId)
{
    if (pkgId > 0) markAsPicked(pkgId);

    // 从 "2 号" 或 "2" 中提取数字
    QRegularExpressionMatch m = QRegularExpression("(\\d+)").match(locker);
    if (!m.hasMatch()) return;

    const QString script = QCoreApplication::applicationDirPath() + "/python/motor.py";
    QProcess::startDetached("bash", {"-c",
        QString("source ~/demo_env/bin/activate && python3 '%1' '%2'")
            .arg(script, m.captured(1))});
}
