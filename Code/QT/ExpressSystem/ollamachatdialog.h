#ifndef OLLAMACHATDIALOG_H
#define OLLAMACHATDIALOG_H

#include <QDialog>
#include <QTextBrowser>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QJsonArray>

class OllamaChatDialog : public QDialog
{
    Q_OBJECT
public:
    explicit OllamaChatDialog(QWidget *parent = nullptr);

private slots:
    void sendMessage();
    void onReplyFinished(QNetworkReply *reply);

private:
    void setupUI();
    void appendBubble(const QString &text, bool isUser);

    QTextBrowser          *m_chat;
    QLineEdit             *m_input;
    QPushButton           *m_sendBtn;
    QLabel                *m_statusLabel;
    QNetworkAccessManager *m_nam;
    QNetworkReply         *m_currentReply;
    QJsonArray             m_history;
    double                 m_scale;
};

#endif // OLLAMACHATDIALOG_H
