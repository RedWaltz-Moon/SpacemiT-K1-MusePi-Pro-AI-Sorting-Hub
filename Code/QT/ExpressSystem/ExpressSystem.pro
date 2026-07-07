QT       += core gui sql widgets network
TARGET = ExpressSystem
TEMPLATE = app
SOURCES += main.cpp mainwindow.cpp pickdialog.cpp consultdialog.cpp admindialog.cpp database.cpp pindialog.cpp settingsdialog.cpp chatdialog.cpp ollamachatdialog.cpp
HEADERS += mainwindow.h pickdialog.h consultdialog.h admindialog.h database.h pindialog.h settingsdialog.h chatdialog.h ollamachatdialog.h
QMAKE_CXXFLAGS += -finput-charset=utf-8 -fexec-charset=utf-8
