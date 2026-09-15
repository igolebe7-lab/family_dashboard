package main

import (
	"familytime/backend/internal/push"
	"fmt"
	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"log"
	"os"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "vapid-keygen" {
		private, public, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("FAMILYTIME_VAPID_PUBLIC_KEY=%s\nFAMILYTIME_VAPID_PRIVATE_KEY=%s\n", public, private)
		return
	}
	app := pocketbase.New()
	var hooks, migrations string
	var automigrate bool
	app.RootCmd.PersistentFlags().StringVar(&hooks, "hooksDir", "pb_hooks", "JS hooks directory")
	app.RootCmd.PersistentFlags().StringVar(&migrations, "migrationsDir", "pb_migrations", "JS migrations directory")
	app.RootCmd.PersistentFlags().BoolVar(&automigrate, "automigrate", false, "Generate schema migrations")
	if err := app.RootCmd.ParseFlags(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
	jsvm.MustRegister(app, jsvm.Config{HooksDir: hooks, MigrationsDir: migrations, HooksWatch: false, HooksPoolSize: 4})
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Dir: migrations, TemplateLang: migratecmd.TemplateLangJS, Automigrate: automigrate})
	if err := push.Register(app, push.ConfigFromEnv()); err != nil {
		log.Fatal(err)
	}
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
