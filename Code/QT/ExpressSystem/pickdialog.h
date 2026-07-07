#ifndef PICKDIALOG_H
#define PICKDIALOG_H

#include <QDialog>
#include <QLabel>
#include <QPushButton>
#include <QTableWidget>

class PickDialog : public QDialog
{
    Q_OBJECT

public:
    explicit PickDialog(QWidget *parent = nullptr);
    ~PickDialog();

private slots:
    void onPick();

private:
    void setupUI();
    void pressDigit(const QString &d);
    void pressBackspace();
    void pressClear();
    void updateDisplay();
    void doSearch();
    void controlMotor(const QString &location);

    QLabel       *phoneDisplay;
    QLabel       *hintLabel;
    QPushButton  *pickBtn;
    QTableWidget *table;
    QString       m_phone;
    int           currentId;
    QString       currentLocation;
};

#endif // PICKDIALOG_H
