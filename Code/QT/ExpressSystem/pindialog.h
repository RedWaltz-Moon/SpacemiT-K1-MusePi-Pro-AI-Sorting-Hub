#ifndef PINDIALOG_H
#define PINDIALOG_H

#include <QDialog>
#include <QLabel>

class PinDialog : public QDialog
{
    Q_OBJECT

public:
    explicit PinDialog(QWidget *parent = nullptr);
    QString code() const { return m_code; }

private:
    void setupUI();
    void pressDigit(const QString &d);
    void pressBackspace();
    void pressConfirm();
    void updateDisplay();

    QLabel  *display;
    QString  m_code;
};

#endif // PINDIALOG_H
