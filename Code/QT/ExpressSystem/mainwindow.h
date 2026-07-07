#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QPushButton>
#include <QLabel>
#include <QTimer>

class SettingsDialog;
class ChatDialog;
class OllamaChatDialog;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void openPickDialog();
    void openConsultDialog();
    void openChatDialog();
    void openLocalAiDialog();
    void openAdminDialog();
    void openSettingsDialog();
    void updateClock();

private:
    void setupHeader(QWidget *central, double s);
    void setupButtons(QWidget *central, double s);

    QPushButton    *pickBtn;
    QPushButton    *consultBtn;
    QPushButton    *chatBtn;
    QPushButton    *localAiBtn;
    QPushButton    *adminBtn;
    QPushButton    *settingsBtn;
    QLabel         *clockLabel;
    QTimer         *clockTimer;
    SettingsDialog    *m_settingsDlg;
    ChatDialog        *m_chatDlg;
    OllamaChatDialog  *m_localAiDlg;
};

#endif // MAINWINDOW_H
