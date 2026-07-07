#include "ollamachatdialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QApplication>
#include <QScreen>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRegularExpression>
#include <QScrollBar>

static const QString API_URL   = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
static const QString API_MODEL = "qwen-turbo";
static const QString API_KEY   = "sk-ef4f1c339eb4420bbbb97a8b878894b3";

OllamaChatDialog::OllamaChatDialog(QWidget *parent) : QDialog(parent)
{
    QScreen *scr = QApplication::primaryScreen();
    m_scale = qBound(0.8,
        qMin((scr ? scr->geometry().width()  : 800) / 800.0,
             (scr ? scr->geometry().height() : 480) / 480.0), 2.0);

    m_currentReply = nullptr;
    m_nam = new QNetworkAccessManager(this);
    connect(m_nam, &QNetworkAccessManager::finished,
            this, &OllamaChatDialog::onReplyFinished);

    setupUI();
}

void OllamaChatDialog::setupUI()
{
    setWindowTitle("云端 AI 对话 (通义千问)");
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
    m_input->setPlaceholderText("输入消息…");
    m_input->setFixedHeight(inputH);
    m_input->setStyleSheet(
        "QLineEdit { background:white; border:1.5px solid #D0DCE8;"
        "  border-radius:4px; color:#1A2744; padding:0 8px; }"
        "QLineEdit:focus { border-color:#2E7D32; }"
    );

    m_sendBtn = new QPushButton("发 送", this);
    m_sendBtn->setFixedHeight(inputH);
    m_sendBtn->setStyleSheet(
        "QPushButton { background:#2E7D32; color:white; border:none;"
        "  border-radius:4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:#388E3C; }"
        "QPushButton:pressed  { background:#1B5E20; }"
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

    connect(m_sendBtn, &QPushButton::clicked,    this, &OllamaChatDialog::sendMessage);
    connect(m_input,   &QLineEdit::returnPressed, this, &OllamaChatDialog::sendMessage);

    appendBubble("你好！有什么可以帮你的？", false);
}

void OllamaChatDialog::appendBubble(const QString &text, bool isUser)
{
    const QString bg     = isUser ? "#2E7D32" : "#FFFFFF";
    const QString color  = isUser ? "#FFFFFF"  : "#1A2744";
    const QString border = isUser ? "none"     : "1px solid #D0DCE8";
    const QString align  = isUser ? "right"    : "left";
    const QString margin = isUser ? "margin:4px 0 4px 60px" : "margin:4px 60px 4px 0";

    QString html = QString(
        "<div style='text-align:%1; %2;'>"
        "<span style='background:%3; color:%4; border:%5; border-radius:8px;"
        "  padding:6px 10px; display:inline-block;'>"
        "%6</span></div>"
    ).arg(align, margin, bg, color, border, text.toHtmlEscaped().replace("\n", "<br>"));

    m_chat->append(html);
    m_chat->verticalScrollBar()->setValue(m_chat->verticalScrollBar()->maximum());
}

void OllamaChatDialog::sendMessage()
{
    if (m_currentReply) {
        m_currentReply->abort();
        if (!m_history.isEmpty()) m_history.removeLast();
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
    m_statusLabel->setText("● 思考中…");
    m_statusLabel->setStyleSheet("color:#E65100; font-size:11px;");
    appendBubble(text, true);

    QJsonObject userMsg;
    userMsg["role"]    = "user";
    userMsg["content"] = text;
    m_history.append(userMsg);

    QJsonObject body;
    body["model"]    = API_MODEL;
    body["messages"] = m_history;
    body["stream"]   = false;

    QNetworkRequest req;
    req.setUrl(QUrl(API_URL));
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setRawHeader("Authorization", ("Bearer " + API_KEY).toUtf8());
    m_currentReply = m_nam->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
}

void OllamaChatDialog::onReplyFinished(QNetworkReply *reply)
{
    m_currentReply = nullptr;
    m_sendBtn->setText("发 送");
    m_sendBtn->setStyleSheet(
        "QPushButton { background:#2E7D32; color:white; border:none;"
        "  border-radius:4px; font-weight:bold; padding:0 16px; min-width:0; }"
        "QPushButton:hover    { background:#388E3C; }"
        "QPushButton:pressed  { background:#1B5E20; }"
        "QPushButton:disabled { background:#C0CDD8; color:#8898A8; }"
    );
    m_statusLabel->setText("● 就绪");
    m_statusLabel->setStyleSheet("color:#5A7090; font-size:11px;");

    if (reply->error() == QNetworkReply::OperationCanceledError) {
        reply->deleteLater();
        return; // 用户主动取消，气泡已追加
    }

    if (reply->error() != QNetworkReply::NoError) {
        appendBubble("连接失败：" + reply->errorString(), false);
        reply->deleteLater();
        return;
    }

    const QByteArray data = reply->readAll();
    reply->deleteLater();

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull() || !doc.isObject()) {
        appendBubble("响应解析失败", false);
        return;
    }

    QString content = doc.object()["choices"].toArray().first().toObject()
                         ["message"].toObject()["content"].toString().trimmed();

    // 去掉 qwen3 的 <think>…</think> 推理块
    content.remove(QRegularExpression("<think>[\\s\\S]*?</think>"));
    content = content.trimmed();

    if (content.isEmpty()) {
        appendBubble("（空响应）", false);
        return;
    }

    QJsonObject assistantMsg;
    assistantMsg["role"]    = "assistant";
    assistantMsg["content"] = content;
    m_history.append(assistantMsg);

    appendBubble(content, false);
}
