#ifndef CHATDIALOG_H
#define CHATDIALOG_H

#include <QDialog>
#include <QTextBrowser>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>
#include <QProcess>

class ChatDialog : public QDialog
{
    Q_OBJECT
public:
    explicit ChatDialog(QWidget *parent = nullptr);

private slots:
    void sendMessage();
    void onProcessFinished(int exitCode, QProcess::ExitStatus);

private:
    void setupUI();
    void appendBubble(const QString &text, bool isUser);
    void handleAgentResponse(const QString &rawBody);
    void processAction(const QString &locker, int pkgId);
    QString buildMessage(const QString &userMsg);

    QTextBrowser          *m_chat;
    QLineEdit             *m_input;
    QPushButton           *m_sendBtn;
    QLabel                *m_statusLabel;
    QProcess              *m_proc;
    double                 m_scale;
};

#endif // CHATDIALOG_H
