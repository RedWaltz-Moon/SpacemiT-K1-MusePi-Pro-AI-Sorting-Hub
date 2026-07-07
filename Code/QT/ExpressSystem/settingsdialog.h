#ifndef SETTINGSDIALOG_H
#define SETTINGSDIALOG_H

#include <QDialog>
#include <QProcess>
#include <QLabel>
#include <QPushButton>
#include <QPlainTextEdit>
#include <QGroupBox>

class SettingsDialog : public QDialog
{
    Q_OBJECT
public:
    explicit SettingsDialog(QWidget *parent = nullptr);
    ~SettingsDialog();

private slots:
    void runInit();
    void startCamera();
    void stopCamera();
    void startDisplay();
    void stopDisplay();
    void startPackIn();
    void stopPackIn();
    void onInitReadyRead();
    void onInitFinished(int exitCode, QProcess::ExitStatus status);
    void onCameraStateChanged(QProcess::ProcessState state);
    void onCameraReadyRead();
    void onDisplayStateChanged(QProcess::ProcessState state);
    void onDisplayReadyRead();
    void onPackInStateChanged(QProcess::ProcessState state);
    void onPackInReadyRead();

private:
    void setupUI();
    QPushButton *makeGroupBtn(const QString &text, const QString &bg,
                              const QString &hover, const QString &press);
    QGroupBox *buildInitBox();
    QGroupBox *buildCameraBox();
    QGroupBox *buildDisplayBox();
    QGroupBox *buildPackInBox();

    int m_btnH;
    int m_btnRad;

    QProcess       *m_initProc;
    QLabel         *m_initStatus;
    QPushButton    *m_initBtn;
    QPlainTextEdit *m_initLog;

    QProcess       *m_cameraProc;
    QLabel         *m_cameraStatus;
    QPushButton    *m_startCamBtn;
    QPushButton    *m_stopCamBtn;
    QPlainTextEdit *m_cameraLog;

    QProcess       *m_displayProc;
    QLabel         *m_displayStatus;
    QPushButton    *m_startDisplayBtn;
    QPushButton    *m_stopDisplayBtn;
    QPlainTextEdit *m_displayLog;

    QProcess       *m_packInProc;
    QLabel         *m_packInStatus;
    QPushButton    *m_startPackInBtn;
    QPushButton    *m_stopPackInBtn;
    QPlainTextEdit *m_packInLog;

    double m_scale;
};

#endif // SETTINGSDIALOG_H
