package statemachine

import (
	"errors"
	"reflect"
	"testing"
)

func TestCanTransitionExhaustive(t *testing.T) {
	valid := map[[2]State]bool{
		{Queued, Building}:          true,
		{Building, ImageReady}:      true,
		{ImageReady, Deploying}:     true,
		{Deploying, HealthChecking}: true,
		{HealthChecking, Running}:   true,
		{Running, Superseded}:       true,
	}
	for _, from := range []State{Queued, Building, ImageReady, Deploying, HealthChecking, Running} {
		valid[[2]State{from, Failed}] = true
		valid[[2]State{from, Cancelled}] = true
	}

	states := append(All(), State("bogus"), State(""))
	for _, from := range states {
		for _, to := range states {
			want := valid[[2]State{from, to}]
			if got := CanTransition(from, to); got != want {
				t.Errorf("CanTransition(%q,%q)=%v want %v", from, to, got, want)
			}
			err := Validate(from, to)
			if (err == nil) != want {
				t.Errorf("Validate(%q,%q) err=%v want ok=%v", from, to, err, want)
			}
		}
	}
}

func TestSpecificInvalid(t *testing.T) {
	cases := [][2]State{
		{Building, Running}, {Running, Building}, {Queued, Running}, {Queued, ImageReady},
		{Failed, Running}, {Cancelled, Queued}, {Superseded, Running}, {Running, Running},
		{Queued, Superseded}, {Building, Superseded}, {Queued, LegacyActive}, {LegacyPending, Building},
		{LegacyActive, Superseded}, {Running, LegacyActive},
	}
	for _, c := range cases {
		if CanTransition(c[0], c[1]) {
			t.Errorf("%q -> %q should be invalid", c[0], c[1])
		}
	}
}

func TestValidateReturnsTypedError(t *testing.T) {
	err := Validate(Building, Running)
	var te *TransitionError
	if !errors.As(err, &te) {
		t.Fatalf("want *TransitionError, got %T", err)
	}
	if te.From != Building || te.To != Running || te.Reason == "" {
		t.Errorf("unexpected error %+v", te)
	}
	if !errors.Is(err, ErrInvalidTransition) {
		t.Error("errors.Is(ErrInvalidTransition) = false")
	}
	if te.Error() == "" {
		t.Error("empty message")
	}
	if Validate(Queued, Building) != nil {
		t.Error("queued->building should validate")
	}
}

func TestIsTerminal(t *testing.T) {
	for _, s := range []State{Failed, Cancelled, Superseded} {
		if !IsTerminal(s) {
			t.Errorf("%q should be terminal", s)
		}
	}
	for _, s := range []State{Queued, Building, ImageReady, Deploying, HealthChecking, Running, LegacyPending, LegacyActive} {
		if IsTerminal(s) {
			t.Errorf("%q should not be terminal", s)
		}
	}
}

func TestNext(t *testing.T) {
	want := map[State]State{
		Queued: Building, Building: ImageReady, ImageReady: Deploying,
		Deploying: HealthChecking, HealthChecking: Running,
	}
	for s, n := range want {
		got, ok := Next(s)
		if !ok || got != n {
			t.Errorf("Next(%q)=%q,%v want %q", s, got, ok, n)
		}
	}
	for _, s := range []State{Running, Failed, Cancelled, Superseded, LegacyActive, LegacyPending, "bogus"} {
		if got, ok := Next(s); ok {
			t.Errorf("Next(%q)=%q, want none", s, got)
		}
	}
}

func TestAllowedFrom(t *testing.T) {
	cases := map[State][]State{
		Queued:         nil,
		Building:       {Queued},
		ImageReady:     {Building},
		Deploying:      {ImageReady},
		HealthChecking: {Deploying},
		Running:        {HealthChecking},
		Superseded:     {Running},
		Failed:         {Queued, Building, ImageReady, Deploying, HealthChecking, Running},
		Cancelled:      {Queued, Building, ImageReady, Deploying, HealthChecking, Running},
		LegacyActive:   nil,
		LegacyPending:  nil,
		"bogus":        nil,
	}
	for to, want := range cases {
		got := AllowedFrom(to)
		if !reflect.DeepEqual(got, want) {
			t.Errorf("AllowedFrom(%q)=%v want %v", to, got, want)
		}
		for _, f := range got {
			if !CanTransition(f, to) {
				t.Errorf("AllowedFrom(%q) contains %q but CanTransition is false", to, f)
			}
		}
	}
}

func TestEnumValues(t *testing.T) {
	want := map[State]string{
		Queued: "queued", Building: "building", ImageReady: "image_ready", Deploying: "deploying",
		HealthChecking: "health_checking", Running: "running", Failed: "failed",
		Cancelled: "cancelled", Superseded: "superseded", LegacyPending: "pending", LegacyActive: "active",
	}
	for s, v := range want {
		if string(s) != v {
			t.Errorf("%v != %q", s, v)
		}
		if !Known(s) {
			t.Errorf("%q should be known", s)
		}
	}
	if Known("bogus") {
		t.Error("bogus should be unknown")
	}
	if !IsLegacy(LegacyActive) || IsLegacy(Running) {
		t.Error("IsLegacy wrong")
	}
	if len(Targets()) != 9 {
		t.Errorf("targets=%d", len(Targets()))
	}
}
